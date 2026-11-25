from rest_framework.permissions import BasePermission

from .services import has_access


class HasCourseAccess(BasePermission):
    """Use on views whose get_object() returns a Course or Lesson (obj-level)."""

    def has_object_permission(self, request, view, obj):
        lesson = obj if hasattr(obj, "module") else None
        course = lesson.course if lesson else obj
        return has_access(request.user, course, lesson)
