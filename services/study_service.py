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

# =========================================================
# 사용자별 공부 과목
# =========================================================

DEFAULT_STUDY_SUBJECTS = [
    "국어",
    "수학",
    "영어",
    "기타",
]


def _normalize_subject_name(value):
    """과목 이름의 앞뒤 공백과 연속 공백을 정리한다."""
    return " ".join(str(value or "").strip().split())


def normalize_study_subjects(subjects):
    """과목 배열을 검증하고 DB에 저장 가능한 형태로 정리한다."""
    if not isinstance(subjects, list):
        raise ValueError("subjects는 배열이어야 합니다.")

    normalized = []
    seen = set()

    for value in subjects:
        name = _normalize_subject_name(value)

        if not name:
            continue

        if len(name) > 20:
            raise ValueError(
                "과목 이름은 20자 이하로 입력해 주세요."
            )

        duplicate_key = name.casefold()

        if duplicate_key in seen:
            raise ValueError(
                f"중복된 과목이 있습니다: {name}"
            )

        seen.add(duplicate_key)
        normalized.append(name)

    if not normalized:
        raise ValueError(
            "과목은 최소 1개 이상 있어야 합니다."
        )

    if len(normalized) > 20:
        raise ValueError(
            "과목은 최대 20개까지 등록할 수 있습니다."
        )

    return normalized


def get_study_subjects(user_id):
    """사용자의 과목을 정렬 순서대로 반환한다."""
    if not user_id:
        return []

    result = (
        supabase
        .table("study_subjects")
        .select("id,name,sort_order,created_at")
        .eq("user_id", user_id)
        .order("sort_order")
        .order("id")
        .execute()
    )

    return result.data or []


def replace_study_subjects(user_id, subjects):
    """
    사용자의 과목 목록을 전달받은 순서대로 동기화한다.

    기존에 남아 있는 과목은 ID를 유지하고, 새 과목만 추가하며,
    목록에서 빠진 과목만 삭제한다. study_records.subject 문자열은
    변경하지 않는다.
    """
    if not user_id:
        raise ValueError("user_id가 필요합니다.")

    normalized = normalize_study_subjects(subjects)
    existing_rows = get_study_subjects(user_id)
    existing_by_name = {
        str(row.get("name") or ""): row
        for row in existing_rows
    }

    for index, name in enumerate(normalized):
        existing = existing_by_name.get(name)

    if existing:
        (
            supabase
            .table("study_subjects")
            .update({
                "sort_order": index
            })
            .eq("id", existing["id"])
            .execute()
        )

    else:
        (
            supabase
            .table("study_subjects")
            .insert({
                "user_id": user_id,
                "name": name,
                "sort_order": index
            })
            .execute()
        )

    desired_names = set(normalized)
    obsolete_ids = [
        row.get("id")
        for row in existing_rows
        if str(row.get("name") or "")
        not in desired_names
        and row.get("id") is not None
    ]

    if obsolete_ids:
        (
            supabase
            .table("study_subjects")
            .delete()
            .eq("user_id", user_id)
            .in_("id", obsolete_ids)
            .execute()
        )

    return get_study_subjects(user_id)
