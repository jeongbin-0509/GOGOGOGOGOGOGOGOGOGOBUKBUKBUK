from flask import session

from extensions import supabase


def get_current_user():
    user_id = session.get("user_id")

    if not user_id:
        return None

    result = (
        supabase
        .table("users")
        .select(
            "id, name, student_id, username, "
            "daily_goal_seconds, created_at"
        )
        .eq("id", user_id)
        .limit(1)
        .execute()
    )

    if not result.data:
        session.clear()
        return None

    return result.data[0]


def find_user_by_username(username):
    result = (
        supabase
        .table("users")
        .select(
            "id, name, student_id, username, password_hash"
        )
        .eq("username", username)
        .limit(1)
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


def update_daily_goal(user_id, goal_seconds):
    result = (
        supabase
        .table("users")
        .update({"daily_goal_seconds": goal_seconds})
        .eq("id", user_id)
        .execute()
    )
    return bool(result.data)

def update_daily_goal(
    user_id,
    daily_goal_seconds,
):
    try:
        response = (
            supabase
            .table("users")
            .update({
                "daily_goal_seconds": (
                    daily_goal_seconds
                ),
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