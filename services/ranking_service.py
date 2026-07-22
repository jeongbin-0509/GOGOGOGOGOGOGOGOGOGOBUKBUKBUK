from extensions import supabase


# =========================================================
# 공통 변환 함수
# =========================================================

def _to_int(value):
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _normalize_text(value):
    return str(value or "").strip()


def _format_class_name(grade, class_no):
    grade = _to_int(grade)
    class_no = _to_int(class_no)

    if grade <= 0 or class_no <= 0:
        return ""

    return f"{grade}학년 {class_no}반"


def _get_class_code(student_id):
    """
    학번 앞 3자리를 학급 코드로 사용한다.

    예:
    21121 -> 211
    """

    student_id = _normalize_text(student_id)

    if len(student_id) < 3:
        return ""

    return student_id[:3]


# =========================================================
# 공동 순위 계산
# =========================================================

def _apply_competition_rank(rows, score_field):
    """
    점수를 기준으로 내림차순 정렬하고 공동 순위를 계산한다.

    예:
    100, 50, 50, 10
    -> 1위, 2위, 2위, 4위
    """

    normalized_rows = []

    for row in rows:
        item = dict(row)

        item[score_field] = _to_int(
            item.get(score_field)
        )

        normalized_rows.append(item)

    normalized_rows.sort(
        key=lambda item: item.get(
            score_field,
            0,
        ),
        reverse=True,
    )

    previous_score = None
    current_rank = 0

    for index, item in enumerate(
        normalized_rows,
        start=1,
    ):
        current_score = _to_int(
            item.get(score_field)
        )

        if current_score != previous_score:
            current_rank = index
            previous_score = current_score

        item["rank"] = current_rank

    return normalized_rows


# =========================================================
# 프론트엔드 응답 형식 변환
# =========================================================

def _normalize_personal_ranking(
    row,
    score_field,
    current_user_id=None,
):
    user_id = row.get("user_id")

    return {
        "user_id": user_id,

        "name": (
            _normalize_text(row.get("name"))
            or "사용자"
        ),

        "student_number": _normalize_text(
            row.get("student_id")
        ),

        "class_name": _format_class_name(
            row.get("grade"),
            row.get("class_no"),
        ),

        "study_seconds": _to_int(
            row.get(score_field)
        ),

        "rank": _to_int(
            row.get("rank")
        ),

        "is_me": (
            current_user_id is not None
            and str(user_id) == str(current_user_id)
        ),
    }


def _normalize_class_ranking(
    row,
    current_class_code=None,
):
    class_code = _normalize_text(
        row.get("class_code")
    )

    return {
        "class_code": class_code,

        "class_name": _format_class_name(
            row.get("grade"),
            row.get("class_no"),
        ),

        "member_count": _to_int(
            row.get("student_count")
        ),

        "total_study_seconds": _to_int(
            row.get("total_seconds")
        ),

        "average_study_seconds": _to_int(
            row.get("average_seconds")
        ),

        "rank": _to_int(
            row.get("rank")
        ),

        "is_my_class": (
            bool(current_class_code)
            and class_code == current_class_code
        ),
    }


# =========================================================
# Supabase 조회
# =========================================================

def _fetch_personal_rankings(
    view_name,
    score_field,
):
    try:
        result = (
            supabase
            .table(view_name)
            .select(
                "user_id,"
                "name,"
                "student_id,"
                "grade,"
                "class_no,"
                "class_code,"
                "total_seconds,"
                "today_seconds"
            )
            .execute()
        )

        rows = result.data or []

        return _apply_competition_rank(
            rows,
            score_field,
        )

    except Exception as error:
        print(
            f"{view_name} 조회 오류:",
            repr(error),
        )
        return []


def _fetch_class_rankings():
    try:
        result = (
            supabase
            .table("class_rankings")
            .select(
                "class_code,"
                "grade,"
                "class_no,"
                "student_count,"
                "total_seconds,"
                "average_seconds"
            )
            .execute()
        )

        rows = result.data or []

        return _apply_competition_rank(
            rows,
            "total_seconds",
        )

    except Exception as error:
        print(
            "class_rankings 조회 오류:",
            repr(error),
        )
        return []


# =========================================================
# 외부 사용 함수
# =========================================================

def get_personal_rankings(
    limit=20,
    current_user_id=None,
):
    """
    전체 누적 개인 랭킹
    """

    rankings = _fetch_personal_rankings(
        view_name="personal_rankings",
        score_field="total_seconds",
    )

    return [
        _normalize_personal_ranking(
            row,
            score_field="total_seconds",
            current_user_id=current_user_id,
        )
        for row in rankings[:limit]
    ]


def get_today_rankings(
    limit=20,
    current_user_id=None,
):
    """
    오늘 개인 랭킹
    """

    rankings = _fetch_personal_rankings(
        view_name="today_personal_rankings",
        score_field="today_seconds",
    )

    return [
        _normalize_personal_ranking(
            row,
            score_field="today_seconds",
            current_user_id=current_user_id,
        )
        for row in rankings[:limit]
    ]


def get_class_rankings(
    limit=20,
    current_student_id=None,
):
    """
    반별 누적 공부시간 랭킹
    """

    current_class_code = _get_class_code(
        current_student_id
    )

    rankings = _fetch_class_rankings()

    return [
        _normalize_class_ranking(
            row,
            current_class_code=current_class_code,
        )
        for row in rankings[:limit]
    ]


# =========================================================
# 내 순위 조회
# =========================================================

def find_user_ranking(
    rankings,
    user_id,
):
    for ranking in rankings:
        ranking_user_id = ranking.get("user_id")

        if str(ranking_user_id) == str(user_id):
            return ranking

    return None


def find_user_rank(
    rankings,
    user_id,
):
    ranking = find_user_ranking(
        rankings,
        user_id,
    )

    if not ranking:
        return None

    return ranking.get("rank")


def find_class_ranking(
    rankings,
    student_id,
):
    class_code = _get_class_code(student_id)

    if not class_code:
        return None

    for ranking in rankings:
        if (
            _normalize_text(
                ranking.get("class_code")
            )
            == class_code
        ):
            return ranking

    return None


def find_class_rank(
    rankings,
    student_id,
):
    ranking = find_class_ranking(
        rankings,
        student_id,
    )

    if not ranking:
        return None

    return ranking.get("rank")


# =========================================================
# 랭킹 API 전체 응답 생성
# =========================================================

def get_ranking_payload(
    period,
    current_user_id,
    current_student_id,
    limit=20,
):
    """
    ranking.js가 요구하는 전체 응답을 생성한다.

    반환 형식:
    {
        "my_ranking": {...},
        "personal_ranking": [...],
        "class_ranking": [...]
    }
    """

    normalized_period = (
        _normalize_text(period)
        .lower()
    )

    today_periods = {
        "today",
        "daily",
        "day",
    }

    if normalized_period in today_periods:
        view_name = "today_personal_rankings"
        score_field = "today_seconds"
    else:
        view_name = "personal_rankings"
        score_field = "total_seconds"

    # 내 순위가 20위 밖이어도 확인할 수 있도록
    # 개인 랭킹 전체를 먼저 불러온다.
    raw_personal_rankings = (
        _fetch_personal_rankings(
            view_name=view_name,
            score_field=score_field,
        )
    )

    normalized_personal_rankings = [
        _normalize_personal_ranking(
            row,
            score_field=score_field,
            current_user_id=current_user_id,
        )
        for row in raw_personal_rankings
    ]

    personal_ranking = (
        normalized_personal_rankings[:limit]
    )

    my_ranking = find_user_ranking(
        normalized_personal_rankings,
        current_user_id,
    )

    if my_ranking is None:
        my_ranking = {
            "user_id": current_user_id,
            "name": "사용자",
            "student_number": (
                _normalize_text(
                    current_student_id
                )
            ),
            "class_name": "",
            "study_seconds": 0,
            "rank": None,
            "is_me": True,
        }

    raw_class_rankings = (
        _fetch_class_rankings()
    )

    current_class_code = _get_class_code(
        current_student_id
    )

    normalized_class_rankings = [
        _normalize_class_ranking(
            row,
            current_class_code=(
                current_class_code
            ),
        )
        for row in raw_class_rankings
    ]

    class_ranking = (
        normalized_class_rankings[:limit]
    )

    return {
        "period": (
            "today"
            if normalized_period in today_periods
            else "total"
        ),
        "my_ranking": my_ranking,
        "personal_ranking": personal_ranking,
        "class_ranking": class_ranking,
    }