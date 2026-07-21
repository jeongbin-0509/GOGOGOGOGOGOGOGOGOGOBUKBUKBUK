from datetime import date

from extensions import supabase


def calculate_study_grade(total_seconds):
    """
    하루 총 공부시간을 기준으로 5등급을 계산합니다.

    1등급: 12시간 이상
    2등급: 8시간 이상
    3등급: 5시간 이상
    4등급: 3시간 이상
    5등급: 3시간 미만
    """

    total_seconds = max(0, int(total_seconds or 0))

    if total_seconds >= 12 * 3600:
        return 1, 5

    if total_seconds >= 8 * 3600:
        return 2, 4

    if total_seconds >= 5 * 3600:
        return 3, 3

    if total_seconds >= 3 * 3600:
        return 4, 2

    return 5, 1


def calculate_average_study_grade(user_id):
    """
    daily_study_stats에 저장된 날짜별 등급을 평균 냅니다.

    반환 예시:
    {
        "average_grade": 2.7,
        "display_grade": 3,
        "measured_days": 4,
        "total_grade_points": 11
    }
    """

    if not user_id:
        return {
            "average_grade": 5.0,
            "display_grade": 5,
            "measured_days": 0,
            "total_grade_points": 0,
        }

    result = (
        supabase
        .table("daily_study_stats")
        .select("study_grade")
        .eq("user_id", user_id)
        .order("study_date")
        .execute()
    )

    stats = result.data or []

    grades = []

    for stat in stats:
        grade = stat.get("study_grade")

        try:
            grade = int(grade)
        except (TypeError, ValueError):
            continue

        if 1 <= grade <= 5:
            grades.append(grade)

    if not grades:
        return {
            "average_grade": 5.0,
            "display_grade": 5,
            "measured_days": 0,
            "total_grade_points": 0,
        }

    average_grade = sum(grades) / len(grades)

    return {
        "average_grade": round(average_grade, 1),
        "display_grade": round(average_grade),
        "measured_days": len(grades),
        "total_grade_points": sum(grades),
    }


def update_daily_study_stats(user_id, study_date=None):
    if not user_id:
        raise ValueError("user_id가 필요합니다.")

    if study_date is None:
        study_date = date.today().isoformat()

    records_result = (
        supabase
        .table("study_records")
        .select("duration_seconds")
        .eq("user_id", user_id)
        .eq("study_date", study_date)
        .execute()
    )

    records = records_result.data or []

    total_seconds = sum(
        int(record.get("duration_seconds") or 0)
        for record in records
    )

    study_grade, grade_point = calculate_study_grade(
        total_seconds
    )

    stats_data = {
        "user_id": user_id,
        "study_date": study_date,
        "total_seconds": total_seconds,
        "study_grade": study_grade,
        "grade_point": grade_point,
    }

    (
        supabase
        .table("daily_study_stats")
        .upsert(
            stats_data,
            on_conflict="user_id,study_date",
        )
        .execute()
    )

    return stats_data


def get_study_total(user_id, study_date=None):
    if not user_id:
        return 0

    query = (
        supabase
        .table("study_records")
        .select("duration_seconds")
        .eq("user_id", user_id)
    )

    if study_date:
        query = query.eq("study_date", study_date)

    result = query.execute()
    records = result.data or []

    return sum(
        int(record.get("duration_seconds") or 0)
        for record in records
    )


def get_recent_records(user_id, limit=10):
    if not user_id:
        return []

    try:
        limit = int(limit)
    except (TypeError, ValueError):
        limit = 10

    limit = max(1, min(limit, 100))

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
    if not isinstance(record_data, dict):
        raise ValueError("record_data는 딕셔너리여야 합니다.")

    required_fields = [
        "user_id",
        "subject",
        "duration_seconds",
        "study_date",
    ]

    for field in required_fields:
        if record_data.get(field) in (None, ""):
            raise ValueError(
                f"{field} 값이 필요합니다."
            )

    result = (
        supabase
        .table("study_records")
        .insert(record_data)
        .execute()
    )

    records = result.data or []

    if not records:
        return None

    return records[0]


def study_record_exists(record_id, user_id):
    if not record_id or not user_id:
        return False

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
    if not record_id:
        raise ValueError("record_id가 필요합니다.")

    if not user_id:
        raise ValueError("user_id가 필요합니다.")

    result = (
        supabase
        .table("study_records")
        .delete()
        .eq("id", record_id)
        .eq("user_id", user_id)
        .execute()
    )

    return result.data or []