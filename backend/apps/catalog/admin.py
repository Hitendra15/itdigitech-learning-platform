from django.contrib import admin

from .models import Course, Lesson, Module, Note, VideoAsset


class ModuleInline(admin.TabularInline):
    model = Module
    extra = 0


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ("title", "slug", "is_published")
    prepopulated_fields = {"slug": ("title",)}
    inlines = [ModuleInline]


class LessonInline(admin.TabularInline):
    model = Lesson
    extra = 0


@admin.register(Module)
class ModuleAdmin(admin.ModelAdmin):
    list_display = ("title", "course", "order")
    inlines = [LessonInline]


class VideoInline(admin.StackedInline):
    model = VideoAsset
    extra = 0


class NoteInline(admin.StackedInline):
    model = Note
    extra = 0


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ("title", "module", "lesson_type", "order", "is_free_preview")
    list_filter = ("lesson_type", "module__course")
    inlines = [VideoInline, NoteInline]
