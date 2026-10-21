from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import StudentProfile, User


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentProfile
        fields = ("full_name", "college_name", "qualification", "city")


class UserSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(read_only=True)
    id = serializers.UUIDField(source="public_id", read_only=True)

    class Meta:
        model = User
        fields = ("id", "email", "phone", "role", "status", "is_email_verified", "profile")
        read_only_fields = ("email", "role", "status", "is_email_verified")


class RegisterSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=15, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True)
    college_name = serializers.CharField(required=False, allow_blank=True)

    def validate_email(self, value):
        value = value.lower()
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated):
        full_name = validated.pop("full_name")
        college = validated.pop("college_name", "")
        user = User.objects.create_user(**validated)
        StudentProfile.objects.create(user=user, full_name=full_name, college_name=college)
        return user


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ResetPasswordSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        from .tokens import user_from_reset

        user = user_from_reset(attrs["uid"], attrs["token"])
        if not user:
            raise serializers.ValidationError({"detail": "This reset link is invalid or has expired. Request a new one."})
        validate_password(attrs["password"], user)
        attrs["user"] = user
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate_current_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Your current password is incorrect.")
        return value

    def validate(self, attrs):
        user = self.context["request"].user
        if attrs["current_password"] == attrs["new_password"]:
            raise serializers.ValidationError({"new_password": "Choose a password different from your current one."})
        validate_password(attrs["new_password"], user)
        return attrs


class EmailTokenSerializer(TokenObtainPairSerializer):
    """Adds role / org claims. USERNAME_FIELD is email so login uses email+password."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["org_id"] = str(user.organization.public_id) if user.organization_id else None
        return token
