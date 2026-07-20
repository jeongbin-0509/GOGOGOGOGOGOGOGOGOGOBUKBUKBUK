from extensions import supabase
from datetime import date


def calculate_study_grade(total_seconds):
    if total_seconds >= 10 * 3600:
        return 1, 5

    if total_seconds >= 7 * 3600:
        return 2, 4

    if total_seconds >= 4 * 3600:
        return 3, 3

    if total_seconds >= 2 * 3600:
        return 4, 2

    return 5, 1


def update_daily_study_stats(supabase, user_id, study_date=None):
    if study_date is None:
        study_date = date.today().isoformat()

    records = (
        supabase.table("study_records")
        .select("duration_seconds")
        .eq("user_id", user_id)
        .eq("study_date", study_date)
        .execute()
    )

    total_seconds = sum(
        int(record.get("duration_seconds", 0))
        for record in records.data
    )

    study_grade, grade_point = calculate_study_grade(total_seconds)

    (
        supabase.table("daily_study_stats")
        .upsert(
            {
                "user_id": user_id,
                "study_date": study_date,
                "total_seconds": total_seconds,
                "study_grade": study_grade,
                "grade_point": grade_point,
            },
            on_conflict="user_id,study_date",
        )
        .execute()
    )

    return {
        "total_seconds": total_seconds,
        "study_grade": study_grade,
        "grade_point": grade_point,
    }

def get_study_total(user_id, study_date=None):
    query = (
        supabase
        .table("study_records")
        .select("duration_seconds")
        .eq("user_id", user_id)
    )

    if study_date:
        query = query.eq("study_date", study_date)

    result = query.execute()

    return sum(
        int(record.get("duration_seconds", 0) or 0)
        for record in (result.data or [])
    )


def get_recent_records(user_id, limit=10):
    result = (
        supabase
        .table("study_records")
        .select(
            "id, subject, duration_seconds, study_date, "
            "started_at, ended_at, created_at"
        )
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []


def create_study_record(record_data):
    result = (
        supabase
        .table("study_records")
        .insert(record_data)
        .execute()
    )
    return result.data[0] if result.data else None


def study_record_exists(record_id, user_id):
    result = (
        supabase
        .table("study_records")
        .select("id")
        .eq("id", record_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    return bool(result.data)


def delete_study_record(record_id, user_id):
    (
        supabase
        .table("study_records")
        .delete()
        .eq("id", record_id)
        .eq("user_id", user_id)
        .execute()
    )
