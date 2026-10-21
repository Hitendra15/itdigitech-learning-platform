from apps.catalog.models import Lesson

from .models import LessonProgress


def course_progress_percent(user, course) -> int:
    total = Lesson.objects.filter(module__course=course, is_published=True, is_deleted=False).count()
    if not total:
        return 0
    done = LessonProgress.objects.filter(user=user, lesson__module__course=course, completed=True).count()
    return round(done * 100 / total)
