from flask import session

from extensions import supabase

def update_session_token(user_id, token):
    result = (
        supabase
        .table("users")
        .update({"session_token": token})
        .eq("id", user_id)
        .execute()
    )

    return result.data[0] if result.data else None


def get_session_token(user_id):
    result = (
        supabase
        .table("users")
        .select("session_token")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )

    return result.data[0]["session_token"] if result.data else None

def get_current_user():
    user_id = session.get("user_id")

    if not user_id:
        return None

    result = (
        supabase
        .table("users")
        .select(
            "id, name, student_id, username, "
            "daily_goal_seconds, force_password_change, created_at"
        )
        .eq("id", user_id)
        .limit(1)
        .execute()
    )

    if not result.data:
        session.clear()
        return None

    return result.data[0]


def get_user_with_password(user_id):
    """비밀번호 검증이 필요한 계정 수정용 사용자 조회."""
    if not user_id:
        return None

    result = (
        supabase
        .table("users")
        .select(
            "id, name, student_id, username, "
            "password_hash, daily_goal_seconds, "
            "force_password_change, created_at"
        )
        .eq("id", user_id)
        .limit(1)
        .execute()
    )

    return result.data[0] if result.data else None


def find_user_by_username(username):
    result = (
        supabase
        .table("users")
        .select(
            "id, name, student_id, username, password_hash, "
            "force_password_change"
        )
        .eq("username", username)
        .limit(1)
        .execute()
    )

    return result.data[0] if result.data else None


def find_user_for_password_reset(name, student_id, username):
    """이름, 학번, 아이디가 모두 일치하는 사용자를 조회한다."""
    result = (
        supabase
        .table("users")
        .select("id, name, student_id, username")
        .eq("name", name)
        .eq("student_id", student_id)
        .eq("username", username)
        .limit(1)
        .execute()
    )

    return result.data[0] if result.data else None


def reset_user_password(user_id, password_hash):
    """임시 비밀번호를 저장하고 다음 로그인 후 변경을 요구한다."""
    result = (
        supabase
        .table("users")
        .update({
            "password_hash": password_hash,
            "force_password_change": True,
        })
        .eq("id", user_id)
        .execute()
    )

    return result.data[0] if result.data else None


def username_exists(username):
    result = (
        supabase
        .table("users")
        .select("id")
        .eq("username", username)
        .limit(1)
        .execute()
    )

    return bool(result.data)


def student_id_exists(student_id):
    result = (
        supabase
        .table("users")
        .select("id")
        .eq("student_id", student_id)
        .limit(1)
        .execute()
    )

    return bool(result.data)


def student_id_exists_except(student_id, excluded_user_id):
    """자기 자신을 제외하고 같은 학번을 사용하는 계정이 있는지 확인."""
    result = (
        supabase
        .table("users")
        .select("id")
        .eq("student_id", student_id)
        .neq("id", excluded_user_id)
        .limit(1)
        .execute()
    )

    return bool(result.data)


def create_user(name, student_id, username, password_hash):
    result = (
        supabase
        .table("users")
        .insert({
            "name": name,
            "student_id": student_id,
            "username": username,
            "password_hash": password_hash,
            "daily_goal_seconds": 28800,
        })
        .execute()
    )

    return result.data[0] if result.data else None


def update_profile(
    user_id,
    name,
    student_id,
    password_hash=None,
):
    """이름, 학번과 선택적으로 비밀번호 해시를 수정."""
    update_data = {
        "name": name,
        "student_id": student_id,
    }

    if password_hash:
        update_data["password_hash"] = password_hash
        update_data["force_password_change"] = False

    result = (
        supabase
        .table("users")
        .update(update_data)
        .eq("id", user_id)
        .execute()
    )

    return result.data[0] if result.data else None


def update_daily_goal(
    user_id,
    daily_goal_seconds,
):
    try:
        response = (
            supabase
            .table("users")
            .update({
                "daily_goal_seconds": daily_goal_seconds,
            })
            .eq("id", user_id)
            .execute()
        )

        data = response.data or []

        if not data:
            raise ValueError(
                "목표 공부시간을 저장하지 못했습니다."
            )

        return data[0]

    except Exception as error:
        print(
            "하루 목표시간 수정 오류:",
            repr(error),
        )
        raise
