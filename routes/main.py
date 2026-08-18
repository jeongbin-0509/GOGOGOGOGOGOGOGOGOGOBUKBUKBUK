from flask import redirect, render_template, url_for

from extensions import supabase

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
    @app.route("/", endpoint="index")
    @login_required
    def index():
        try:
            user = get_current_user()
            if not user:
                return redirect(url_for("login"))

            today_seconds = get_study_total(user["id"], today_iso())
            total_seconds = get_study_total(user["id"])
            recent_records = get_recent_records(user["id"], limit=10)

            personal_rankings = get_personal_rankings(limit=500)
            today_rankings = get_today_rankings(limit=20)
            class_rankings = get_class_rankings(limit=100)

            personal_rank = find_user_rank(personal_rankings, user["id"])
            today_rank = find_user_rank(today_rankings, user["id"])
            class_rank = find_class_rank(class_rankings, user["student_id"])

            # =====================================================
            # 최종 등급 랭킹
            # - 등급 평균은 2026-08-13까지의 daily_study_stats만 사용
            # - 숫자가 낮은 등급이 더 좋은 성적이므로 오름차순 정렬
            # - 같은 평균 등급은 공동 순위(1, 1, 3 방식)
            # =====================================================
            grade_rows = (
                supabase
                .table("daily_study_stats")
                .select("user_id,study_grade,study_date")
                .lte("study_date", "2026-08-13")
                .execute()
            ).data or []

            grade_buckets = {}

            for row in grade_rows:
                row_user_id = str(row.get("user_id") or "")
                grade_value = row.get("study_grade")

                if not row_user_id or grade_value is None:
                    continue

                try:
                    grade_value = float(grade_value)
                except (TypeError, ValueError):
                    continue

                grade_buckets.setdefault(
                    row_user_id,
                    [],
                ).append(grade_value)

            final_grade_map = {
                row_user_id: round(
                    sum(values) / len(values),
                    2,
                )
                for row_user_id, values in grade_buckets.items()
                if values
            }

            # 시간 랭킹에도 8월 13일까지의 최종 평균 등급을 표시한다.
            for ranking_item in personal_rankings:
                ranking_user_id = str(
                    ranking_item.get("user_id")
                    or ranking_item.get("id")
                    or ""
                )
                ranking_item["average_grade"] = (
                    final_grade_map.get(ranking_user_id)
                )

            # 등급 랭킹은 기존 개인 랭킹의 사용자 정보에
            # 최종 평균 등급을 결합해 새로 만든다.
            grade_rankings = []

            for ranking_item in personal_rankings:
                ranking_user_id = str(
                    ranking_item.get("user_id")
                    or ranking_item.get("id")
                    or ""
                )

                average_grade = final_grade_map.get(
                    ranking_user_id
                )

                if average_grade is None:
                    continue

                grade_rankings.append({
                    **ranking_item,
                    "average_grade": average_grade,
                })

            grade_rankings.sort(
                key=lambda item: (
                    float(item.get("average_grade") or 999),
                    -int(
                        item.get("total_seconds")
                        or item.get("total_study_seconds")
                        or 0
                    ),
                )
            )

            previous_grade = None
            previous_rank = 0

            for index, ranking_item in enumerate(
                grade_rankings,
                start=1,
            ):
                current_grade = ranking_item["average_grade"]

                if (
                    previous_grade is not None
                    and current_grade == previous_grade
                ):
                    ranking_item["grade_rank"] = previous_rank
                else:
                    ranking_item["grade_rank"] = index
                    previous_rank = index
                    previous_grade = current_grade

            final_average_grade = final_grade_map.get(
                str(user["id"])
            )

            grade_rank = next(
                (
                    item.get("grade_rank")
                    for item in grade_rankings
                    if str(
                        item.get("user_id")
                        or item.get("id")
                        or ""
                    ) == str(user["id"])
                ),
                None,
            )

            goal_seconds = int(user.get("daily_goal_seconds") or 28800)
            if goal_seconds <= 0:
                goal_seconds = 28800

            goal_percentage = min(
                100,
                round(today_seconds / goal_seconds * 100),
            )

            study_grade_info = get_study_grade_info(today_seconds)
            next_grade_progress = get_next_grade_progress(today_seconds)

            return render_template(
                "index.html",
                user=user,
                today_seconds=today_seconds,
                total_seconds=total_seconds,
                recent_records=recent_records,
                personal_rankings=personal_rankings,
                today_rankings=today_rankings,
                class_rankings=class_rankings,
                personal_rank=personal_rank,
                grade_rank=grade_rank,
                today_rank=today_rank,
                class_rank=class_rank,
                grade_rankings=grade_rankings,
                final_average_grade=final_average_grade,
                goal_seconds=goal_seconds,
                goal_percentage=goal_percentage,
                study_grade=study_grade_info["grade"],
                study_grade_info=study_grade_info,
                next_grade_progress=next_grade_progress,
            )

        except Exception as error:
            print("메인 페이지 오류:", repr(error))
            return "페이지를 불러오는 중 오류가 발생했습니다.", 500
