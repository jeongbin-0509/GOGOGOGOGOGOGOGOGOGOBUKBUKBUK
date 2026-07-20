from extensions import supabase


def _get_rankings(view_name, limit=20):
    try:
        result = (
            supabase
            .table(view_name)
            .select("*")
            .order("rank")
            .limit(limit)
            .execute()
        )
        return result.data or []
    except Exception as error:
        print(f"{view_name} 조회 오류:", repr(error))
        return []


def get_personal_rankings(limit=20):
    return _get_rankings("personal_rankings", limit)


def get_today_rankings(limit=20):
    return _get_rankings("today_personal_rankings", limit)


def get_class_rankings(limit=20):
    return _get_rankings("class_rankings", limit)


def find_user_rank(rankings, user_id):
    for ranking in rankings:
        ranking_user_id = ranking.get("user_id") or ranking.get("id")
        if str(ranking_user_id) == str(user_id):
            return ranking.get("rank")
    return None


def find_class_rank(rankings, student_id):
    class_code = str(student_id or "")[:3]

    for ranking in rankings:
        if str(ranking.get("class_code")) == class_code:
            return ranking.get("rank")
    return None
