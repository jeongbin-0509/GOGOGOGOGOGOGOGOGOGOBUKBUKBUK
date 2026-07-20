import os
import secrets
from datetime import date, datetime, timezone
from functools import wraps

from dotenv import load_dotenv
from flask import (
    Flask,
    jsonify,
    redirect,
    render_template,
    request,
    session,
    url_for,
)
from supabase import Client, create_client
from werkzeug.security import (
    check_password_hash,
    generate_password_hash,
)


# =========================================================
# Flask 및 환경변수 설정
# =========================================================

load_dotenv()

app = Flask(__name__)

app.secret_key = os.getenv(
    "SECRET_KEY",
    secrets.token_hex(32),
)

app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=(
        os.getenv("SESSION_COOKIE_SECURE", "false").lower()
        == "true"
    ),
    PERMANENT_SESSION_LIFETIME=60 * 60 * 24 * 30,
)


# =========================================================
# Supabase 연결
# =========================================================

SUPABASE_URL = os.getenv("SUPABASE_URL")

SUPABASE_SERVICE_ROLE_KEY = os.getenv(
    "SUPABASE_SERVICE_ROLE_KEY"
)

if not SUPABASE_URL:
    raise RuntimeError(
        ".env에 SUPABASE_URL이 없습니다."
    )

if not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError(
        ".env에 SUPABASE_SERVICE_ROLE_KEY가 없습니다."
    )

supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
)


# =========================================================
# 공통 함수
# =========================================================

def get_request_data():
    """
    JSON 요청과 일반 HTML form 요청을 모두 처리한다.
    """

    if request.is_json:
        data = request.get_json(silent=True)

        if isinstance(data, dict):
            return data

    return request.form.to_dict()


def parse_int(value, default=None):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def parse_float(value, default=None):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def normalize_username(value):
    return str(value or "").strip().lower()


def today_iso():
    return date.today().isoformat()


def login_required(view_function):
    @wraps(view_function)
    def wrapped_view(*args, **kwargs):
        if "user_id" not in session:
            if request.path.startswith("/api/"):
                return jsonify({
                    "success": False,
                    "message": "로그인이 필요합니다.",
                    "redirect": url_for("login"),
                }), 401

            return redirect(url_for("login"))

        return view_function(*args, **kwargs)

    return wrapped_view


# =========================================================
# 사용자 조회
# =========================================================

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


# =========================================================
# 공부시간 조회
# =========================================================

def get_study_total(user_id, study_date=None):
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

    total_seconds = 0

    for record in result.data or []:
        total_seconds += int(
            record.get("duration_seconds", 0) or 0
        )

    return total_seconds


def get_recent_records(user_id, limit=10):
    result = (
        supabase
        .table("study_records")
        .select(
            "id, subject, duration_seconds, "
            "study_date, started_at, ended_at, created_at"
        )
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )

    return result.data or []


# =========================================================
# 랭킹 조회
# =========================================================

def get_personal_rankings(limit=20):
    try:
        result = (
            supabase
            .table("personal_rankings")
            .select("*")
            .order("rank")
            .limit(limit)
            .execute()
        )

        return result.data or []

    except Exception as error:
        print(
            "personal_rankings 조회 오류:",
            repr(error),
        )

        return []


def get_class_rankings(limit=20):
    """
    학번이 21121이면 앞의 3자리인 211을 반 코드로 사용한다.
    DB View의 이름은 class_rankings를 유지한다.
    """

    try:
        result = (
            supabase
            .table("class_rankings")
            .select("*")
            .order("rank")
            .limit(limit)
            .execute()
        )

        return result.data or []

    except Exception as error:
        print(
            "class_rankings 조회 오류:",
            repr(error),
        )

        return []


def find_user_rank(rankings, user_id):
    for ranking in rankings:
        ranking_user_id = (
            ranking.get("user_id")
            or ranking.get("id")
        )

        if str(ranking_user_id) == str(user_id):
            return ranking.get("rank")

    return None


# =========================================================
# 메인 페이지
# =========================================================

@app.route("/")
@login_required
def index():
    try:
        user = get_current_user()

        if not user:
            return redirect(url_for("login"))

        today_seconds = get_study_total(
            user["id"],
            today_iso(),
        )

        total_seconds = get_study_total(
            user["id"]
        )

        recent_records = get_recent_records(
            user["id"],
            limit=10,
        )

        personal_rankings = get_personal_rankings(
            limit=20
        )

        class_rankings = get_class_rankings(
            limit=20
        )

        personal_rank = find_user_rank(
            personal_rankings,
            user["id"],
        )

        goal_seconds = int(
            user.get("daily_goal_seconds") or 28800
        )

        if goal_seconds <= 0:
            goal_seconds = 28800

        goal_percentage = min(
            100,
            round(
                today_seconds
                / goal_seconds
                * 100
            ),
        )

        return render_template(
            "index.html",
            user=user,
            today_seconds=today_seconds,
            total_seconds=total_seconds,
            recent_records=recent_records,
            personal_rankings=personal_rankings,
            class_rankings=class_rankings,
            personal_rank=personal_rank,
            goal_seconds=goal_seconds,
            goal_percentage=goal_percentage,
        )

    except Exception as error:
        print(
            "메인 페이지 오류:",
            repr(error),
        )

        return (
            "페이지를 불러오는 중 오류가 발생했습니다.",
            500,
        )


# =========================================================
# 로그인
# =========================================================

@app.route(
    "/login",
    methods=["GET", "POST"],
)
def login():
    if request.method == "GET":
        if "user_id" in session:
            return redirect(url_for("index"))

        return render_template("login.html")

    try:
        data = get_request_data()

        username = normalize_username(
            data.get("username")
        )

        password = str(
            data.get("password") or ""
        )

        remember_value = data.get(
            "remember",
            False,
        )

        remember = (
            remember_value is True
            or str(remember_value).lower()
            in ["true", "1", "on", "yes"]
        )

        if not username:
            return jsonify({
                "success": False,
                "message": "아이디를 입력해 주세요.",
            }), 400

        if not password:
            return jsonify({
                "success": False,
                "message": "비밀번호를 입력해 주세요.",
            }), 400

        result = (
            supabase
            .table("users")
            .select(
                "id, name, student_id, "
                "username, password_hash"
            )
            .eq("username", username)
            .limit(1)
            .execute()
        )

        if not result.data:
            return jsonify({
                "success": False,
                "message": (
                    "아이디 또는 비밀번호가 "
                    "올바르지 않습니다."
                ),
            }), 401

        user = result.data[0]

        password_hash = user.get(
            "password_hash"
        )

        if (
            not password_hash
            or not check_password_hash(
                password_hash,
                password,
            )
        ):
            return jsonify({
                "success": False,
                "message": (
                    "아이디 또는 비밀번호가 "
                    "올바르지 않습니다."
                ),
            }), 401

        session.clear()

        session["user_id"] = user["id"]
        session["username"] = user["username"]
        session["name"] = user["name"]
        session["student_id"] = user["student_id"]

        session.permanent = remember

        return jsonify({
            "success": True,
            "message": "로그인되었습니다.",
            "redirect": url_for("index"),
        })

    except Exception as error:
        print(
            "로그인 오류:",
            repr(error),
        )

        return jsonify({
            "success": False,
            "message": (
                "로그인 처리 중 서버 오류가 "
                "발생했습니다."
            ),
        }), 500


# =========================================================
# 회원가입
# =========================================================

@app.route(
    "/signup",
    methods=["GET", "POST"],
)
def signup():
    if request.method == "GET":
        if "user_id" in session:
            return redirect(url_for("index"))

        return render_template("signup.html")

    try:
        data = get_request_data()

        name = str(
            data.get("name") or ""
        ).strip()

        student_id = str(
            data.get("student_id") or ""
        ).strip()

        username = normalize_username(
            data.get("username")
        )

        password = str(
            data.get("password") or ""
        )

        password_confirm = str(
            data.get("password_confirm")
            or data.get("passwordConfirm")
            or ""
        )

        if not name:
            return jsonify({
                "success": False,
                "message": "이름을 입력해 주세요.",
            }), 400

        if len(name) > 20:
            return jsonify({
                "success": False,
                "message": (
                    "이름은 20자 이하로 입력해 주세요."
                ),
            }), 400

        if (
            len(student_id) != 5
            or not student_id.isdigit()
        ):
            return jsonify({
                "success": False,
                "message": (
                    "학번 5자리를 정확하게 입력해 주세요."
                ),
            }), 400

        if len(username) < 4:
            return jsonify({
                "success": False,
                "message": (
                    "아이디는 4자 이상이어야 합니다."
                ),
            }), 400

        if len(username) > 30:
            return jsonify({
                "success": False,
                "message": (
                    "아이디는 30자 이하로 입력해 주세요."
                ),
            }), 400

        if not username.replace("_", "").isalnum():
            return jsonify({
                "success": False,
                "message": (
                    "아이디는 영문, 숫자, "
                    "밑줄만 사용할 수 있습니다."
                ),
            }), 400

        if len(password) < 6:
            return jsonify({
                "success": False,
                "message": (
                    "비밀번호는 6자 이상이어야 합니다."
                ),
            }), 400

        if len(password) > 100:
            return jsonify({
                "success": False,
                "message": "비밀번호가 너무 깁니다.",
            }), 400

        if password != password_confirm:
            return jsonify({
                "success": False,
                "message": (
                    "비밀번호 확인이 일치하지 않습니다."
                ),
            }), 400

        username_result = (
            supabase
            .table("users")
            .select("id")
            .eq("username", username)
            .limit(1)
            .execute()
        )

        if username_result.data:
            return jsonify({
                "success": False,
                "message": (
                    "이미 사용 중인 아이디입니다."
                ),
            }), 409

        student_result = (
            supabase
            .table("users")
            .select("id")
            .eq("student_id", student_id)
            .limit(1)
            .execute()
        )

        if student_result.data:
            return jsonify({
                "success": False,
                "message": (
                    "해당 학번으로 이미 가입한 "
                    "계정이 있습니다."
                ),
            }), 409

        password_hash = generate_password_hash(
            password
        )

        insert_result = (
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

        if not insert_result.data:
            raise RuntimeError(
                "Supabase 사용자 저장 실패"
            )

        return jsonify({
            "success": True,
            "message": (
                "회원가입이 완료되었습니다."
            ),
            "redirect": url_for("login"),
        }), 201

    except Exception as error:
        print(
            "회원가입 오류:",
            repr(error),
        )

        error_text = str(error).lower()

        if (
            "duplicate" in error_text
            or "unique" in error_text
            or "23505" in error_text
        ):
            return jsonify({
                "success": False,
                "message": (
                    "이미 사용 중인 정보입니다."
                ),
            }), 409

        return jsonify({
            "success": False,
            "message": (
                "회원가입 처리 중 서버 오류가 "
                "발생했습니다."
            ),
        }), 500


# =========================================================
# 로그아웃
# =========================================================

@app.route("/logout")
def logout():
    session.clear()

    return redirect(url_for("login"))


# =========================================================
# 타이머 공부 기록 저장
# =========================================================

@app.route(
    "/api/study-records",
    methods=["POST"],
)
@login_required
def save_study_record():
    try:
        data = get_request_data()

        subject = str(
            data.get("subject") or ""
        ).strip()

        duration_seconds = parse_int(
            data.get("duration_seconds")
        )

        started_at = data.get("started_at")
        ended_at = data.get("ended_at")

        if not subject:
            return jsonify({
                "success": False,
                "message": (
                    "공부한 과목을 입력해 주세요."
                ),
            }), 400

        if len(subject) > 30:
            return jsonify({
                "success": False,
                "message": (
                    "과목명은 30자 이하로 "
                    "입력해 주세요."
                ),
            }), 400

        if (
            duration_seconds is None
            or duration_seconds < 10
        ):
            return jsonify({
                "success": False,
                "message": (
                    "10초 이상 공부해야 기록할 수 있습니다."
                ),
            }), 400

        if duration_seconds > 57600:
            return jsonify({
                "success": False,
                "message": (
                    "한 번에 최대 16시간까지만 "
                    "기록할 수 있습니다."
                ),
            }), 400

        insert_data = {
            "user_id": session["user_id"],
            "subject": subject,
            "duration_seconds": duration_seconds,
            "study_date": today_iso(),
        }

        if started_at:
            insert_data["started_at"] = started_at

        if ended_at:
            insert_data["ended_at"] = ended_at

        result = (
            supabase
            .table("study_records")
            .insert(insert_data)
            .execute()
        )

        if not result.data:
            raise RuntimeError(
                "공부 기록 저장 실패"
            )

        today_seconds = get_study_total(
            session["user_id"],
            today_iso(),
        )

        return jsonify({
            "success": True,
            "message": (
                "공부 기록이 저장되었습니다."
            ),
            "today_seconds": today_seconds,
        }), 201

    except Exception as error:
        print(
            "공부 기록 저장 오류:",
            repr(error),
        )

        return jsonify({
            "success": False,
            "message": (
                "공부 기록 저장 중 오류가 발생했습니다."
            ),
        }), 500


# =========================================================
# 직접 공부 기록 저장
# =========================================================

@app.route(
    "/api/study-records/manual",
    methods=["POST"],
)
@login_required
def save_manual_record():
    try:
        data = get_request_data()

        subject = str(
            data.get("subject") or ""
        ).strip()

        minutes = parse_int(
            data.get("minutes")
        )

        study_date = str(
            data.get("study_date")
            or today_iso()
        )

        if not subject:
            return jsonify({
                "success": False,
                "message": (
                    "공부한 과목을 입력해 주세요."
                ),
            }), 400

        if len(subject) > 30:
            return jsonify({
                "success": False,
                "message": (
                    "과목명은 30자 이하로 "
                    "입력해 주세요."
                ),
            }), 400

        if (
            minutes is None
            or minutes < 1
            or minutes > 960
        ):
            return jsonify({
                "success": False,
                "message": (
                    "공부 시간은 1분 이상 "
                    "960분 이하로 입력해 주세요."
                ),
            }), 400

        try:
            parsed_study_date = date.fromisoformat(
                study_date
            )
        except ValueError:
            return jsonify({
                "success": False,
                "message": (
                    "날짜 형식이 올바르지 않습니다."
                ),
            }), 400

        if parsed_study_date > date.today():
            return jsonify({
                "success": False,
                "message": (
                    "미래 날짜에는 기록할 수 없습니다."
                ),
            }), 400

        now_iso = datetime.now(
            timezone.utc
        ).isoformat()

        result = (
            supabase
            .table("study_records")
            .insert({
                "user_id": session["user_id"],
                "subject": subject,
                "duration_seconds": minutes * 60,
                "study_date": study_date,
                "started_at": None,
                "ended_at": now_iso,
            })
            .execute()
        )

        if not result.data:
            raise RuntimeError(
                "공부 기록 저장 실패"
            )

        return jsonify({
            "success": True,
            "message": (
                "공부 기록이 저장되었습니다."
            ),
        }), 201

    except Exception as error:
        print(
            "직접 기록 저장 오류:",
            repr(error),
        )

        return jsonify({
            "success": False,
            "message": (
                "공부 기록 저장 중 오류가 발생했습니다."
            ),
        }), 500


# =========================================================
# 목표시간 변경
# =========================================================

@app.route(
    "/api/goal",
    methods=["POST"],
)
@login_required
def update_goal():
    try:
        data = get_request_data()

        hours = parse_float(
            data.get("hours")
        )

        if (
            hours is None
            or hours < 0.5
            or hours > 16
        ):
            return jsonify({
                "success": False,
                "message": (
                    "목표시간은 0.5시간 이상 "
                    "16시간 이하로 입력해 주세요."
                ),
            }), 400

        goal_seconds = round(
            hours * 3600
        )

        result = (
            supabase
            .table("users")
            .update({
                "daily_goal_seconds": goal_seconds
            })
            .eq(
                "id",
                session["user_id"],
            )
            .execute()
        )

        if not result.data:
            raise RuntimeError(
                "목표시간 변경 실패"
            )

        return jsonify({
            "success": True,
            "message": (
                "목표시간이 변경되었습니다."
            ),
            "goal_seconds": goal_seconds,
        })

    except Exception as error:
        print(
            "목표시간 변경 오류:",
            repr(error),
        )

        return jsonify({
            "success": False,
            "message": (
                "목표시간 변경 중 오류가 발생했습니다."
            ),
        }), 500


# =========================================================
# 공부 기록 삭제
# =========================================================

@app.route(
    "/api/study-records/<int:record_id>",
    methods=["DELETE"],
)
@login_required
def delete_study_record(record_id):
    try:
        existing_result = (
            supabase
            .table("study_records")
            .select("id")
            .eq("id", record_id)
            .eq(
                "user_id",
                session["user_id"],
            )
            .limit(1)
            .execute()
        )

        if not existing_result.data:
            return jsonify({
                "success": False,
                "message": (
                    "공부 기록을 찾을 수 없습니다."
                ),
            }), 404

        (
            supabase
            .table("study_records")
            .delete()
            .eq("id", record_id)
            .eq(
                "user_id",
                session["user_id"],
            )
            .execute()
        )

        return jsonify({
            "success": True,
            "message": (
                "공부 기록이 삭제되었습니다."
            ),
        })

    except Exception as error:
        print(
            "공부 기록 삭제 오류:",
            repr(error),
        )

        return jsonify({
            "success": False,
            "message": (
                "공부 기록 삭제 중 오류가 발생했습니다."
            ),
        }), 500


# =========================================================
# 오류 처리
# =========================================================

@app.errorhandler(404)
def not_found(error):
    if request.path.startswith("/api/"):
        return jsonify({
            "success": False,
            "message": (
                "요청한 API를 찾을 수 없습니다."
            ),
        }), 404

    return "페이지를 찾을 수 없습니다.", 404


@app.errorhandler(405)
def method_not_allowed(error):
    if (
        request.path.startswith("/api/")
        or request.path in ["/login", "/signup"]
    ):
        return jsonify({
            "success": False,
            "message": (
                "허용되지 않은 요청 방식입니다."
            ),
        }), 405

    return "허용되지 않은 요청입니다.", 405


# =========================================================
# 실행
# =========================================================

if __name__ == "__main__":
    debug_mode = (
        os.getenv("FLASK_DEBUG", "1")
        == "1"
    )

    port = int(
        os.getenv("PORT", "5000")
    )

    app.run(
        host="0.0.0.0",
        port=port,
        debug=debug_mode,
    )