from extensions import supabase


def _to_int(value):
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _apply_competition_rank(rows, score_field):
    """
    점수를 기준으로 내림차순 정렬한 뒤 공동 순위를 계산한다.

    예:
    100, 50, 50, 10
    -> 1위, 2위, 2위, 4위
    """

    normalized = []

    for row in rows:
        item = dict(row)

        item[score_field] = _to_int(
            item.get(score_field)
        )

        normalized.append(item)

    normalized.sort(
        key=lambda item: item.get(score_field, 0),
        reverse=True,
    )

    previous_score = None
    current_rank = 0

    for index, item in enumerate(
        normalized,
        start=1,
    ):
        current_score = item.get(score_field, 0)

        if current_score != previous_score:
            current_rank = index
            previous_score = current_score

        item["rank"] = current_rank

    return normalized


def _get_personal_view_rankings(
    view_name,
    score_field,
    limit=20,
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
                "today_seconds,"
                "rank"
            )
            .execute()
        )

        rows = result.data or []

        rankings = _apply_competition_rank(
            rows,
            score_field,
        )

        return rankings[:limit]

    except Exception as error:
        print(
            f"{view_name} 조회 오류:",
            repr(error),
        )
        return []


def _get_class_view_rankings(limit=20):
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
                "average_seconds,"
                "rank"
            )
            .execute()
        )

        rows = result.data or []

        rankings = _apply_competition_rank(
            rows,
            "total_seconds",
        )

        return rankings[:limit]

    except Exception as error:
        print(
            "class_rankings 조회 오류:",
            repr(error),
        )
        return []


def get_personal_rankings(limit=20):
    """
    전체 누적 개인 랭킹
    """
    return _get_personal_view_rankings(
        view_name="personal_rankings",
        score_field="total_seconds",
        limit=limit,
    )


def get_today_rankings(limit=20):
    """
    오늘 개인 랭킹
    """
    return _get_personal_view_rankings(
        view_name="today_personal_rankings",
        score_field="today_seconds",
        limit=limit,
    )


def get_class_rankings(limit=20):
    """
    반별 누적 공부시간 랭킹
    """
    return _get_class_view_rankings(
        limit=limit,
    )


def find_user_rank(rankings, user_id):
    for ranking in rankings:
        ranking_user_id = (
            ranking.get("user_id")
            or ranking.get("id")
        )

        if str(ranking_user_id) == str(user_id):
            return ranking.get("rank")

    return None


def find_class_rank(rankings, student_id):
    class_code = str(student_id or "")[:3]

    for ranking in rankings:
        if str(ranking.get("class_code")) == class_code:
            return ranking.get("rank")

    return None