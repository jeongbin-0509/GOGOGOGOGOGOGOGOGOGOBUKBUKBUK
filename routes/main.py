from flask import redirect, render_template, url_for

from services.ranking_service import (
    find_class_rank,
    find_user_rank,
    get_class_rankings,
    get_personal_rankings,
    get_today_rankings,
)
from services.study_service import get_recent_records, get_study_total
from services.user_service import get_current_user
from utils.decorators import login_required
from utils.grades import get_next_grade_progress, get_study_grade_info
from utils.helpers import today_iso


def register_main_routes(app):
    # =====================================================
    # 대시보드
    # =====================================================
    @app.route("/", endpoint="dashboard")
    @app.route("/dashboard")
    @login_required
    def dashboard():
        try:
            user = get_current_user()

            if not user:
                return redirect(url_for("login"))

            today_seconds = get_study_total(
                user["id"],
                today_iso(),
            )

            total_seconds = get_study_total(user["id"])

            recent_records = get_recent_records(
                user["id"],
                limit=10,
            )

            personal_rankings = get_personal_rankings(limit=20)
            today_rankings = get_today_rankings(limit=20)
            class_rankings = get_class_rankings(limit=20)

            personal_rank = find_user_rank(
                personal_rankings,
                user["id"],
            )

            today_rank = find_user_rank(
                today_rankings,
                user["id"],
            )

            class_rank = find_class_rank(
                class_rankings,
                user["student_id"],
            )

            goal_seconds = int(
                user.get("daily_goal_seconds") or 28800
            )

            if goal_seconds <= 0:
                goal_seconds = 28800

            goal_percentage = min(
                100,
                round(today_seconds / goal_seconds * 100),
            )

            study_grade_info = get_study_grade_info(
                today_seconds
            )

            next_grade_progress = get_next_grade_progress(
                today_seconds
            )

            return render_template(
                "dashboard.html",
                user=user,
                today_seconds=today_seconds,
                total_seconds=total_seconds,
                recent_records=recent_records,
                personal_rankings=personal_rankings,
                today_rankings=today_rankings,
                class_rankings=class_rankings,
                personal_rank=personal_rank,
                today_rank=today_rank,
                class_rank=class_rank,
                goal_seconds=goal_seconds,
                goal_percentage=goal_percentage,
                study_grade=study_grade_info["grade"],
                study_grade_info=study_grade_info,
                next_grade_progress=next_grade_progress,
            )

        except Exception as error:
            print("대시보드 오류:", repr(error))

            return (
                "페이지를 불러오는 중 오류가 발생했습니다.",
                500,
            )

    # =====================================================
    # 랭킹 페이지
    # =====================================================
    @app.route("/ranking", endpoint="ranking")
    @login_required
    def ranking():
        try:
            user = get_current_user()

            if not user:
                return redirect(url_for("login"))

            personal_rankings = get_personal_rankings(limit=100)
            today_rankings = get_today_rankings(limit=100)
            class_rankings = get_class_rankings(limit=100)

            personal_rank = find_user_rank(
                personal_rankings,
                user["id"],
            )

            today_rank = find_user_rank(
                today_rankings,
                user["id"],
            )

            class_rank = find_class_rank(
                class_rankings,
                user["student_id"],
            )

            return render_template(
                "ranking.html",
                user=user,
                personal_rankings=personal_rankings,
                today_rankings=today_rankings,
                class_rankings=class_rankings,
                personal_rank=personal_rank,
                today_rank=today_rank,
                class_rank=class_rank,
            )

        except Exception as error:
            print("랭킹 페이지 오류:", repr(error))

            return (
                "랭킹을 불러오는 중 오류가 발생했습니다.",
                500,
            )