GRADE_NAMES = {
    1: "최상위",
    2: "우수",
    3: "성실",
    4: "노력",
    5: "도전",
    6: "성장",
    7: "시작",
    8: "준비",
    9: "미기록",
}


def get_study_grade(seconds):
    seconds = int(seconds or 0)

    if seconds >= 12 * 3600:
        return 1
    if seconds >= 10 * 3600:
        return 2
    if seconds >= 8 * 3600:
        return 3
    if seconds >= 6 * 3600:
        return 4
    if seconds >= 4 * 3600:
        return 5
    if seconds >= 2 * 3600:
        return 6
    if seconds >= 1 * 3600:
        return 7
    if seconds >= 30 * 60:
        return 8
    return 9


def get_study_grade_info(seconds):
    grade = get_study_grade(seconds)
    return {
        "grade": grade,
        "name": GRADE_NAMES[grade],
    }


def get_next_grade_progress(seconds):
    seconds = int(seconds or 0)
    current_grade = get_study_grade(seconds)

    if current_grade == 1:
        return {
            "next_grade": None,
            "remaining_seconds": 0,
            "message": "최고 등급을 달성했습니다.",
        }

    targets = {
        1: 12 * 3600,
        2: 10 * 3600,
        3: 8 * 3600,
        4: 6 * 3600,
        5: 4 * 3600,
        6: 2 * 3600,
        7: 1 * 3600,
        8: 30 * 60,
    }

    next_grade = current_grade - 1
    remaining_seconds = max(0, targets[next_grade] - seconds)

    return {
        "next_grade": next_grade,
        "remaining_seconds": remaining_seconds,
        "message": None,
    }
