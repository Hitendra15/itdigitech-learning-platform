import secrets

from django.conf import settings
from django.core.cache import cache
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer

from apps.notifications import emails

from . import auth, tokens
from .models import StudentProfile, User
from .serializers import (
    ChangePasswordSerializer, EmailTokenSerializer, ForgotPasswordSerializer, ProfileSerializer,
    RegisterSerializer, ResetPasswordSerializer, UserSerializer,
)


class ScopedAuthThrottleMixin:
    throttle_scope = "auth"


class RegisterView(ScopedAuthThrottleMixin, APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        ser = RegisterSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = ser.save()
        emails.send_welcome_and_verify(user, tokens.make_verify_token(user))
        access, refresh = auth.tokens_for_user(user)
        resp = Response({"access": access, "user": UserSerializer(user).data}, status=status.HTTP_201_CREATED)
        return auth.set_refresh_cookie(resp, refresh)


class LoginView(ScopedAuthThrottleMixin, APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        email, password = request.data.get("email", "").lower(), request.data.get("password", "")
        # Tell a suspended student why they cannot sign in (only after the password is proven correct).
        suspended = User.objects.filter(email=email, status=User.Status.SUSPENDED).first()
        if suspended and suspended.check_password(password):
            return Response({"detail": "Your account is suspended. Contact support to restore access."},
                            status=status.HTTP_403_FORBIDDEN)
        ser = EmailTokenSerializer(data={"email": email, "password": password})
        try:
            ser.is_valid(raise_exception=True)
        except (AuthenticationFailed, InvalidToken):
            return Response({"detail": "Email or password is incorrect."}, status=status.HTTP_401_UNAUTHORIZED)
        data = ser.validated_data
        user = ser.user
        resp = Response({"access": data["access"], "user": UserSerializer(user).data})
        return auth.set_refresh_cookie(resp, data["refresh"])


class RefreshView(ScopedAuthThrottleMixin, APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        token = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if not token:
            return Response({"detail": "No refresh token."}, status=status.HTTP_401_UNAUTHORIZED)
        ser = TokenRefreshSerializer(data={"refresh": token})
        try:
            ser.is_valid(raise_exception=True)
        except TokenError:
            resp = Response({"detail": "Session expired."}, status=status.HTTP_401_UNAUTHORIZED)
            return auth.clear_refresh_cookie(resp)
        resp = Response({"access": ser.validated_data["access"]})
        return auth.set_refresh_cookie(resp, ser.validated_data["refresh"])


class LogoutView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        token = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if token:
            auth.blacklist(token)
        return auth.clear_refresh_cookie(Response(status=status.HTTP_204_NO_CONTENT))


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user

    def patch(self, request, *args, **kwargs):
        profile, _ = StudentProfile.objects.get_or_create(
            user=request.user, defaults={"full_name": request.user.email}
        )
        ser = ProfileSerializer(profile, data=request.data.get("profile", {}), partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        if "phone" in request.data:
            request.user.phone = request.data["phone"]
            request.user.save(update_fields=["phone"])
        return Response(UserSerializer(request.user).data)


class WsTicketView(APIView):
    """Short-lived one-time ticket so WebSocket URLs never carry a JWT."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        ticket = secrets.token_urlsafe(24)
        cache.set(f"wsticket:{ticket}", request.user.pk, timeout=30)
        return Response({"ticket": ticket})


class PasswordResetThrottle(ScopedAuthThrottleMixin):
    throttle_scope = "password_reset"


class ForgotPasswordView(PasswordResetThrottle, APIView):
    """Always answers 200 so the endpoint cannot be used to discover which emails have accounts."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        ser = ForgotPasswordSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = User.objects.filter(email=ser.validated_data["email"].lower(), is_active=True).first()
        if user:
            uid, token = tokens.make_reset_token(user)
            emails.send_password_reset(user, uid, token)
        return Response({"detail": "If an account exists for that email, a reset link is on its way."})


class ResetPasswordView(PasswordResetThrottle, APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        """Lets the reset page check a link before showing the form."""
        ok = tokens.user_from_reset(request.query_params.get("uid", ""), request.query_params.get("token", ""))
        return Response({"valid": bool(ok)})

    def post(self, request):
        ser = ResetPasswordSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = ser.validated_data["user"]
        user.set_password(ser.validated_data["password"])
        user.save(update_fields=["password"])
        auth.revoke_all_sessions(user)
        emails.send_password_changed(user)
        return Response({"detail": "Your password has been reset. You can sign in now."})


class ChangePasswordView(APIView):
    def post(self, request):
        ser = ChangePasswordSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        request.user.set_password(ser.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        auth.revoke_all_sessions(request.user)
        emails.send_password_changed(request.user)
        # Keep this device signed in with a fresh session.
        access, refresh = auth.tokens_for_user(request.user)
        resp = Response({"detail": "Password updated.", "access": access})
        return auth.set_refresh_cookie(resp, refresh)


class VerifyEmailView(ScopedAuthThrottleMixin, APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        user = tokens.user_from_verify(request.data.get("token", ""))
        if not user:
            return Response({"detail": "This verification link is invalid or has expired."}, status=400)
        if not user.is_email_verified:
            user.is_email_verified = True
            user.save(update_fields=["is_email_verified"])
        return Response({"detail": "Email confirmed.", "email": user.email})


class ResendVerificationView(PasswordResetThrottle, APIView):
    def post(self, request):
        if request.user.is_email_verified:
            return Response({"detail": "Your email is already confirmed."})
        emails.send_verify(request.user, tokens.make_verify_token(request.user))
        return Response({"detail": "Verification email sent."})
