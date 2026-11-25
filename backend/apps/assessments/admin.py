from django.contrib import admin

from .models import Attempt, Question, Test


class QuestionInline(admin.StackedInline):
    model = Question
    extra = 0


@admin.register(Test)
class TestAdmin(admin.ModelAdmin):
    list_display = ("title", "course", "duration_minutes", "pass_percent")
    inlines = [QuestionInline]


admin.site.register(Attempt)
