from flask import (
    jsonify,
    redirect,
    render_template,
    request,
    url_for,
)

from services.ranking_service import (
    find_class_rank,
    find_user_rank,
    get_class_rankings,
    get_personal_rankings,
    get_today_rankings,
)
from services.study_service import (
    calculate_average_study_grade,
    get_recent_records,
    get_study_total,
)
from services.user_service import (
    get_current_user,
    update_daily_goal,
)
from utils.decorators import login_required
from utils.helpers import today_iso


# =========================================================
# 공통 변환 함수
# =========================================================

def _to_int(value, default=0):
    """
    None, 문자열 등의 값을 안전하게 정수로 변환한다.
    """
    try:
        return int(float(value or 0))
    except (TypeError, ValueError):
        return default


def _get_first(data, *keys, default=None):
    """
    여러 후보 필드 중 실제로 존재하는 첫 번째 값을 반환한다.
    """
    if not isinstance(data, dict):
        return default

    for key in keys:
        value = data.get(key)

        if value is not None:
            return value

    return default


def _get_user_class_name(user):
    """
    사용자 데이터에서 학급 표시값을 추출한다.
    """
    if not isinstance(user, dict):
        return ""

    class_name = _get_first(
        user,
        "class_name",
        "class",
        "student_class",
        "class_number",
        default="",
    )

    if class_name:
        return str(class_name)

    student_id = str(
        _get_first(
            user,
            "student_id",
            "student_number",
            "usernum",
            default="",
        )
        or ""
    ).strip()

    # 예: 21121 → 2학년 11반
    if len(student_id) >= 3 and student_id[:3].isdigit():
        grade = student_id[0]
        class_number = int(student_id[1:3])

        return f"{grade}학년 {class_number}반"

    return ""


def _normalize_personal_ranking(
    ranking,
    index,
    current_user_id,
):
    """
    ranking_service에서 받은 개인 랭킹 데이터를
    ranking.js가 요구하는 형태로 변환한다.
    """
    if not isinstance(ranking, dict):
        ranking = {}

    user_id = _get_first(
        ranking,
        "user_id",
        "id",
        "student_user_id",
        default="",
    )

    rank = _to_int(
        _get_first(
            ranking,
            "rank",
            "ranking",
            "position",
            default=index + 1,
        ),
        index + 1,
    )

    name = str(
        _get_first(
            ranking,
            "name",
            "username",
            "user_name",
            "student_name",
            default="사용자",
        )
        or "사용자"
    )

    student_number = str(
        _get_first(
            ranking,
            "student_number",
            "student_id",
            "usernum",
            default="",
        )
        or ""
    )

    class_name = str(
        _get_first(
            ranking,
            "class_name",
            "class",
            "student_class",
            default="",
        )
        or ""
    )

    study_seconds = _to_int(
        _get_first(
            ranking,
            "study_seconds",
            "total_study_seconds",
            "total_seconds",
            "seconds",
            "study_time",
            default=0,
        )
    )

    ranking_is_me = bool(
        _get_first(
            ranking,
            "is_me",
            "is_current_user",
            default=False,
        )
    )

    is_me = (
        ranking_is_me
        or str(user_id) == str(current_user_id)
    )

    return {
        "rank": rank,
        "user_id": user_id,
        "name": name,
        "student_number": student_number,
        "class_name": class_name,
        "study_seconds": study_seconds,
        "is_me": is_me,
    }


def _normalize_class_ranking(
    ranking,
    index,
    current_class_name,
):
    """
    반 랭킹 데이터를 ranking.js 형식으로 변환한다.
    """
    if not isinstance(ranking, dict):
        ranking = {}

    rank = _to_int(
        _get_first(
            ranking,
            "rank",
            "ranking",
            "position",
            default=index + 1,
        ),
        index + 1,
    )

    class_name = str(
        _get_first(
            ranking,
            "class_name",
            "class",
            "student_class",
            default="학급",
        )
        or "학급"
    )

    member_count = _to_int(
        _get_first(
            ranking,
            "member_count",
            "user_count",
            "student_count",
            "count",
            default=0,
        )
    )

    total_study_seconds = _to_int(
        _get_first(
            ranking,
            "total_study_seconds",
            "study_seconds",
            "total_seconds",
            "seconds",
            default=0,
        )
    )

    average_study_seconds = _get_first(
        ranking,
        "average_study_seconds",
        "average_seconds",
        "avg_study_seconds",
        "avg_seconds",
        default=None,
    )

    if average_study_seconds is None:
        if member_count > 0:
            average_study_seconds = (
                total_study_seconds // member_count
            )
        else:
            average_study_seconds = 0

    average_study_seconds = _to_int(
        average_study_seconds
    )

    ranking_is_my_class = bool(
        _get_first(
            ranking,
            "is_my_class",
            default=False,
        )
    )

    is_my_class = (
        ranking_is_my_class
        or (
            bool(current_class_name)
            and class_name == current_class_name
        )
    )

    return {
        "rank": rank,
        "class_name": class_name,
        "member_count": member_count,
        "total_study_seconds": total_study_seconds,
        "average_study_seconds": average_study_seconds,
        "is_my_class": is_my_class,
    }


def _load_personal_rankings(period, limit=100):
    """
    기간에 맞는 개인 랭킹을 불러온다.

    ranking_service가 period 인자를 지원하면 사용하고,
    지원하지 않는 기존 함수도 호환한다.
    """
    if period == "today":
        return get_today_rankings(limit=limit) or []

    # 주간 또는 전체 랭킹
    # ranking_service가 period를 지원하는 경우 우선 사용
    try:
        return (
            get_personal_rankings(
                limit=limit,
                period=period,
            )
            or []
        )
    except TypeError:
        return (
            get_personal_rankings(
                limit=limit
            )
            or []
        )


def _load_class_rankings(period, limit=100):
    """
    기간에 맞는 반 랭킹을 불러온다.

    기존 ranking_service와 기간 지원 버전 모두 호환한다.
    """
    try:
        return (
            get_class_rankings(
                limit=limit,
                period=period,
            )
            or []
        )
    except TypeError:
        return (
            get_class_rankings(
                limit=limit
            )
            or []
        )


def register_main_routes(app):

    # =====================================================
    # 프로필 페이지
    # =====================================================
    @app.route(
        "/profile",
        endpoint="profile",
    )
    @login_required
    def profile():
        try:
            user = get_current_user()

            if not user:
                return redirect(
                    url_for("login")
                )

            return render_template(
                "profile.html",
                user=user,
            )

        except Exception as error:
            print(
                "프로필 페이지 오류:",
                repr(error),
            )

            return (
                "프로필을 불러오는 중 "
                "오류가 발생했습니다.",
                500,
            )

    # =====================================================
    # 프로필 조회 API
    # =====================================================
    @app.route(
        "/api/profile",
        methods=["GET"],
        endpoint="profile_api",
    )
    def profile_api():
        try:
            user = get_current_user()

            if not user:
                return jsonify({
                    "success": False,
                    "message": "로그인이 필요합니다.",
                }), 401

            user_id = user["id"]

            today_seconds = get_study_total(
                user_id,
                today_iso(),
            )

            total_seconds = get_study_total(
                user_id
            )

            average_grade_info = (
                calculate_average_study_grade(
                    user_id
                )
                or {}
            )

            try:
                daily_goal_seconds = int(
                    user.get(
                        "daily_goal_seconds"
                    )
                    or 28800
                )
            except (TypeError, ValueError):
                daily_goal_seconds = 28800

            if daily_goal_seconds <= 0:
                daily_goal_seconds = 28800

            return jsonify({
                "success": True,

                "user": {
                    "id": user.get("id"),

                    "name": (
                        user.get("name")
                        or user.get("username")
                        or user.get("user_name")
                        or "사용자"
                    ),

                    "student_number": (
                        user.get("student_number")
                        or user.get("student_id")
                        or user.get("usernum")
                        or ""
                    ),

                    "class_name": (
                        user.get("class_name")
                        or user.get("student_class")
                        or user.get("class")
                        or ""
                    ),

                    "email": (
                        user.get("email")
                        or ""
                    ),
                },

                "today_seconds": int(
                    today_seconds or 0
                ),

                "total_seconds": int(
                    total_seconds or 0
                ),

                "average_grade": (
                    average_grade_info.get(
                        "average_grade",
                        5.0,
                    )
                ),

                "display_grade": (
                    average_grade_info.get(
                        "display_grade",
                        5,
                    )
                ),

                "measured_days": (
                    average_grade_info.get(
                        "measured_days",
                        0,
                    )
                ),

                "daily_goal_seconds": (
                    daily_goal_seconds
                ),
            }), 200

        except Exception as error:
            print(
                "프로필 API 오류:",
                repr(error),
            )

            return jsonify({
                "success": False,
                "message": (
                    "프로필 정보를 불러오는 중 "
                    "오류가 발생했습니다."
                ),
            }), 500

    # =====================================================
    # 목표 공부시간 수정 API
    # =====================================================
    @app.route(
        "/api/profile/goal",
        methods=["PATCH"],
        endpoint="profile_goal_api",
    )
    def profile_goal_api():
        try:
            user = get_current_user()

            if not user:
                return jsonify({
                    "success": False,
                    "message": "로그인이 필요합니다.",
                }), 401

            data = request.get_json(
                silent=True
            ) or {}

            try:
                daily_goal_seconds = int(
                    data.get(
                        "daily_goal_seconds"
                    )
                )
            except (TypeError, ValueError):
                return jsonify({
                    "success": False,
                    "message": (
                        "목표 공부시간 형식이 "
                        "올바르지 않습니다."
                    ),
                }), 400

            minimum_seconds = 30 * 60
            maximum_seconds = 23 * 3600 + 59 * 60

            if (
                daily_goal_seconds
                < minimum_seconds
            ):
                return jsonify({
                    "success": False,
                    "message": (
                        "목표 공부시간은 최소 "
                        "30분 이상이어야 합니다."
                    ),
                }), 400

            if (
                daily_goal_seconds
                > maximum_seconds
            ):
                return jsonify({
                    "success": False,
                    "message": (
                        "목표 공부시간은 하루를 "
                        "초과할 수 없습니다."
                    ),
                }), 400

            updated_user = update_daily_goal(
                user["id"],
                daily_goal_seconds,
            )

            return jsonify({
                "success": True,
                "message": (
                    "하루 목표 공부시간을 "
                    "저장했습니다."
                ),
                "daily_goal_seconds": (
                    updated_user.get(
                        "daily_goal_seconds",
                        daily_goal_seconds,
                    )
                ),
            }), 200

        except Exception as error:
            print(
                "목표 공부시간 수정 오류:",
                repr(error),
            )

            return jsonify({
                "success": False,
                "message": (
                    "목표 공부시간을 저장하는 중 "
                    "오류가 발생했습니다."
                ),
            }), 500

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

            user_id = user["id"]
            today = today_iso()

            # 오늘 공부시간
            today_seconds = get_study_total(
                user_id,
                today,
            )

            # 전체 누적 공부시간
            total_seconds = get_study_total(
                user_id
            )

            # 최근 공부 기록
            recent_records = get_recent_records(
                user_id,
                limit=10,
            )

            # 날짜별 공부 등급 평균
            average_grade_info = (
                calculate_average_study_grade(
                    user_id
                )
                or {}
            )

            average_grade = (
                average_grade_info.get(
                    "average_grade",
                    5.0,
                )
            )

            display_grade = (
                average_grade_info.get(
                    "display_grade",
                    5,
                )
            )

            measured_days = (
                average_grade_info.get(
                    "measured_days",
                    0,
                )
            )

            # 랭킹 데이터
            personal_rankings = (
                get_personal_rankings(
                    limit=20
                )
                or []
            )

            today_rankings = (
                get_today_rankings(
                    limit=20
                )
                or []
            )

            class_rankings = (
                get_class_rankings(
                    limit=20
                )
                or []
            )

            personal_rank = find_user_rank(
                personal_rankings,
                user_id,
            )

            today_rank = find_user_rank(
                today_rankings,
                user_id,
            )

            class_rank = find_class_rank(
                class_rankings,
                user.get("student_id"),
            )

            # 하루 목표 공부시간
            try:
                goal_seconds = int(
                    user.get(
                        "daily_goal_seconds"
                    )
                    or 28800
                )
            except (TypeError, ValueError):
                goal_seconds = 28800

            if goal_seconds <= 0:
                goal_seconds = 28800

            goal_percentage = min(
                100,
                round(
                    today_seconds
                    / goal_seconds
                    * 100
                ),
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

                average_grade=average_grade,
                display_grade=display_grade,
                measured_days=measured_days,
            )

        except Exception as error:
            print(
                "대시보드 오류:",
                repr(error),
            )

            return (
                "페이지를 불러오는 중 오류가 발생했습니다.",
                500,
            )

    # =====================================================
    # 집중 모드 페이지
    # =====================================================
    @app.route("/focus", endpoint="focus")
    @login_required
    def focus():
        try:
            user = get_current_user()

            if not user:
                return redirect(url_for("login"))

            subject = str(
                request.args.get("subject") or ""
            ).strip()

            if not subject:
                return redirect(
                    url_for("dashboard")
                )

            if len(subject) > 30:
                subject = subject[:30]

            today_seconds = get_study_total(
                user["id"],
                today_iso(),
            )

            try:
                goal_seconds = int(
                    user.get(
                        "daily_goal_seconds"
                    )
                    or 28800
                )
            except (TypeError, ValueError):
                goal_seconds = 28800

            if goal_seconds <= 0:
                goal_seconds = 28800

            return render_template(
                "focus.html",
                user=user,
                subject=subject,
                today_seconds=today_seconds,
                goal_seconds=goal_seconds,
            )

        except Exception as error:
            print(
                "집중 모드 오류:",
                repr(error),
            )

            return redirect(
                url_for("dashboard")
            )

    # =====================================================
    # 랭킹 페이지
    # =====================================================
    @app.route(
        "/ranking",
        endpoint="ranking",
    )
    @login_required
    def ranking():
        try:
            user = get_current_user()

            if not user:
                return redirect(url_for("login"))

            personal_rankings = (
                get_personal_rankings(
                    limit=100
                )
                or []
            )

            today_rankings = (
                get_today_rankings(
                    limit=100
                )
                or []
            )

            class_rankings = (
                get_class_rankings(
                    limit=100
                )
                or []
            )

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
                user.get("student_id"),
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
            print(
                "랭킹 페이지 오류:",
                repr(error),
            )

            return (
                "랭킹을 불러오는 중 오류가 발생했습니다.",
                500,
            )

    # =====================================================
    # 랭킹 API
    # ranking.js:
    # GET /api/ranking?period=today
    # =====================================================
    @app.route(
        "/api/ranking",
        methods=["GET"],
        endpoint="ranking_api",
    )
    def ranking_api():
        try:
            user = get_current_user()

            if not user:
                return jsonify({
                    "success": False,
                    "message": "로그인이 필요합니다.",
                }), 401

            period = str(
                request.args.get(
                    "period",
                    "today",
                )
            ).strip().lower()

            if period not in {
                "today",
                "week",
                "total",
            }:
                return jsonify({
                    "success": False,
                    "message": "올바르지 않은 집계 기간입니다.",
                }), 400

            user_id = user["id"]
            current_class_name = (
                _get_user_class_name(user)
            )

            # Supabase 기반 ranking_service 호출
            raw_personal_rankings = (
                _load_personal_rankings(
                    period=period,
                    limit=100,
                )
            )

            raw_class_rankings = (
                _load_class_rankings(
                    period=period,
                    limit=100,
                )
            )

            # ranking.js가 요구하는 데이터 구조로 변환
            personal_rankings = [
                _normalize_personal_ranking(
                    ranking=item,
                    index=index,
                    current_user_id=user_id,
                )
                for index, item in enumerate(
                    raw_personal_rankings
                )
            ]

            class_rankings = [
                _normalize_class_ranking(
                    ranking=item,
                    index=index,
                    current_class_name=(
                        current_class_name
                    ),
                )
                for index, item in enumerate(
                    raw_class_rankings
                )
            ]

            # 현재 사용자 순위 찾기
            my_ranking = next(
                (
                    item
                    for item in personal_rankings
                    if item["is_me"]
                ),
                None,
            )

            # 랭킹에 없더라도 사용자 정보는 표시
            if my_ranking is None:
                if period == "today":
                    my_study_seconds = (
                        get_study_total(
                            user_id,
                            today_iso(),
                        )
                    )
                elif period == "total":
                    my_study_seconds = (
                        get_study_total(
                            user_id
                        )
                    )
                else:
                    # study_service에 주간 합계 함수가
                    # 아직 없는 경우 안전하게 0으로 처리
                    my_study_seconds = 0

                my_ranking = {
                    "rank": None,
                    "user_id": user_id,
                    "name": str(
                        _get_first(
                            user,
                            "name",
                            "username",
                            "user_name",
                            default="사용자",
                        )
                        or "사용자"
                    ),
                    "student_number": str(
                        _get_first(
                            user,
                            "student_number",
                            "student_id",
                            "usernum",
                            default="",
                        )
                        or ""
                    ),
                    "class_name": (
                        current_class_name
                    ),
                    "study_seconds": (
                        _to_int(
                            my_study_seconds
                        )
                    ),
                    "is_me": True,
                }

            return jsonify({
                "success": True,
                "period": period,
                "my_ranking": my_ranking,
                "personal_ranking": (
                    personal_rankings
                ),
                "class_ranking": (
                    class_rankings
                ),
            }), 200

        except Exception as error:
            print(
                "랭킹 API 오류:",
                repr(error),
            )

            return jsonify({
                "success": False,
                "message": (
                    "랭킹을 불러오는 중 "
                    "오류가 발생했습니다."
                ),
            }), 500