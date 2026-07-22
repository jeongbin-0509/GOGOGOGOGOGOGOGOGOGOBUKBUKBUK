from datetime import date

from extensions import supabase


# =========================================================
# 공통 변환
# =========================================================

def _to_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


# =========================================================
# 공부 등급
# =========================================================

def calculate_study_grade(total_seconds):
    """
    하루 총 공부시간을 기준으로 5등급을 계산한다.

    1등급: 12시간 이상
    2등급: 8시간 이상
    3등급: 5시간 이상
    4등급: 3시간 이상
    5등급: 3시간 미만
    """

    total_seconds = max(
        0,
        _to_int(total_seconds),
    )

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
    daily_study_stats에 저장된 날짜별 등급의 평균을 계산한다.
    """

    empty_result = {
        "average_grade": 5.0,
        "display_grade": 5,
        "measured_days": 0,
        "total_grade_points": 0,
    }

    if not user_id:
        return empty_result

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
        grade = _to_int(
            stat.get("study_grade"),
            default=-1,
        )

        if 1 <= grade <= 5:
            grades.append(grade)

    if not grades:
        return empty_result

    average_grade = sum(grades) / len(grades)

    return {
        "average_grade": round(
            average_grade,
            1,
        ),
        "display_grade": round(
            average_grade,
        ),
        "measured_days": len(grades),
        "total_grade_points": sum(grades),
    }


# =========================================================
# 날짜별 통계
# =========================================================

def update_daily_study_stats(
    user_id,
    study_date=None,
):
    if not user_id:
        raise ValueError(
            "user_id가 필요합니다."
        )

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
        max(
            0,
            _to_int(
                record.get("duration_seconds")
            ),
        )
        for record in records
    )

    study_grade, grade_point = (
        calculate_study_grade(
            total_seconds
        )
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
            on_conflict=(
                "user_id,study_date"
            ),
        )
        .execute()
    )

    return stats_data


# =========================================================
# 공부시간 조회
# =========================================================

def get_study_total(
    user_id,
    study_date=None,
):
    if not user_id:
        return 0

    query = (
        supabase
        .table("study_records")
        .select("duration_seconds")
        .eq("user_id", user_id)
    )

    if study_date:
        query = query.eq(
            "study_date",
            study_date,
        )

    result = query.execute()
    records = result.data or []

    return sum(
        max(
            0,
            _to_int(
                record.get("duration_seconds")
            ),
        )
        for record in records
    )


def get_recent_records(
    user_id,
    limit=10,
):
    if not user_id:
        return []

    limit = _to_int(
        limit,
        default=10,
    )

    limit = max(
        1,
        min(limit, 100),
    )

    result = (
        supabase
        .table("study_records")
        .select(
            "id,"
            "subject,"
            "duration_seconds,"
            "study_date,"
            "started_at,"
            "ended_at,"
            "created_at"
        )
        .eq("user_id", user_id)
        .order(
            "created_at",
            desc=True,
        )
        .limit(limit)
        .execute()
    )

    return result.data or []


# =========================================================
# 공부 기록 생성
# =========================================================

def create_study_record(record_data):
    if not isinstance(record_data, dict):
        raise ValueError(
            "record_data는 딕셔너리여야 합니다."
        )

    required_fields = [
        "user_id",
        "subject",
        "duration_seconds",
        "study_date",
    ]

    for field in required_fields:
        if record_data.get(field) in (
            None,
            "",
        ):
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


# =========================================================
# 공부 기록 단건 조회
# =========================================================

def get_study_record(
    record_id,
    user_id,
):
    if not record_id or not user_id:
        return None

    result = (
        supabase
        .table("study_records")
        .select(
            "id,"
            "user_id,"
            "subject,"
            "duration_seconds,"
            "study_date,"
            "started_at,"
            "ended_at,"
            "created_at"
        )
        .eq("id", record_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )

    records = result.data or []

    if not records:
        return None

    return records[0]


def study_record_exists(
    record_id,
    user_id,
):
    return (
        get_study_record(
            record_id,
            user_id,
        )
        is not None
    )


# =========================================================
# 공부 기록 시간 수정
# =========================================================

def update_study_record_duration(
    record_id,
    user_id,
    duration_seconds,
):
    """
    공부 기록의 시간을 감소시키는 경우에만 수정한다.

    반환값:
    {
        "record": 수정된 기록,
        "previous_duration_seconds": 기존 시간,
        "reduced_seconds": 감소한 시간
    }
    """

    if not record_id:
        raise ValueError(
            "record_id가 필요합니다."
        )

    if not user_id:
        raise ValueError(
            "user_id가 필요합니다."
        )

    new_duration = _to_int(
        duration_seconds,
        default=-1,
    )

    if new_duration < 1:
        raise ValueError(
            "공부시간은 최소 1초 이상이어야 합니다."
        )

    current_record = get_study_record(
        record_id,
        user_id,
    )

    if not current_record:
        raise LookupError(
            "공부 기록을 찾을 수 없습니다."
        )

    previous_duration = max(
        0,
        _to_int(
            current_record.get(
                "duration_seconds"
            )
        ),
    )

    if new_duration >= previous_duration:
        raise ValueError(
            "공부시간은 기존 기록보다 줄이는 것만 가능합니다."
        )

    result = (
        supabase
        .table("study_records")
        .update({
            "duration_seconds": new_duration,
        })
        .eq("id", record_id)
        .eq("user_id", user_id)
        .execute()
    )

    updated_records = result.data or []

    if updated_records:
        updated_record = updated_records[0]
    else:
        updated_record = {
            **current_record,
            "duration_seconds": new_duration,
        }

    return {
        "record": updated_record,
        "previous_duration_seconds": (
            previous_duration
        ),
        "reduced_seconds": (
            previous_duration
            - new_duration
        ),
    }