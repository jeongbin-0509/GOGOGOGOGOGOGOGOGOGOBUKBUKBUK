from extensions import supabase


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
