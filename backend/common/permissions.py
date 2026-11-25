from rest_framework.permissions import BasePermission


class IsStudent(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user.is_authenticated and request.user.role == "student")


class IsAdminRole(BasePermission):
    """Platform admins: role 'admin' or a Django superuser."""

    def has_permission(self, request, view):
        u = request.user
        return bool(u.is_authenticated and (u.role == "admin" or u.is_superuser))


class IsFaculty(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user.is_authenticated and request.user.role == "faculty")
