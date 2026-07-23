from datetime import datetime, timezone
import secrets
import string

from flask import jsonify, redirect, render_template, request, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash

from services.user_service import (
    create_user,
    find_user_by_username,
    find_user_for_password_reset,
    reset_user_password,
    student_id_exists,
    username_exists,
)
from utils.helpers import get_request_data, normalize_username


def register_auth_routes(app):
    @app.route("/login", methods=["GET", "POST"], endpoint="login")
    def login():
        if request.method == "GET":
            if "user_id" in session:
                return redirect(url_for("dashboard"))
            return render_template("login.html")

        try:
            data = get_request_data()
            username = normalize_username(data.get("username"))
            password = str(data.get("password") or "")
            remember_value = data.get("remember", False)
            remember = (
                remember_value is True
                or str(remember_value).lower() in ["true", "1", "on", "yes"]
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

            user = find_user_by_username(username)
            if not user:
                return jsonify({
                    "success": False,
                    "message": "아이디 또는 비밀번호가 올바르지 않습니다.",
                }), 401

            password_hash = user.get("password_hash")
            if not password_hash or not check_password_hash(password_hash, password):
                return jsonify({
                    "success": False,
                    "message": "아이디 또는 비밀번호가 올바르지 않습니다.",
                }), 401

            session.clear()
            session["user_id"] = user["id"]
            session["username"] = user["username"]
            session["name"] = user["name"]
            session["student_id"] = user["student_id"]
            session["force_password_change"] = bool(
                user.get("force_password_change")
            )
            session.permanent = remember

            force_password_change = bool(
                user.get("force_password_change")
            )

            return jsonify({
                "success": True,
                "message": (
                    "임시 비밀번호로 로그인했습니다. 새 비밀번호를 설정해 주세요."
                    if force_password_change
                    else "로그인되었습니다."
                ),
                "force_password_change": force_password_change,
                "redirect": (
                    "/profile?force_password_change=1"
                    if force_password_change
                    else url_for("dashboard")
                ),
            })

        except Exception as error:
            print("로그인 오류:", repr(error))
            return jsonify({
                "success": False,
                "message": "로그인 처리 중 서버 오류가 발생했습니다.",
            }), 500

    @app.route("/signup", methods=["GET", "POST"], endpoint="signup")
    def signup():
        if request.method == "GET":
            if "user_id" in session:
                return redirect(url_for("dashboard"))
            return render_template("signup.html")

        try:
            data = get_request_data()
            name = str(data.get("name") or "").strip()
            student_id = str(data.get("student_id") or "").strip()
            username = normalize_username(data.get("username"))
            password = str(data.get("password") or "")
            password_confirm = str(
                data.get("password_confirm")
                or data.get("passwordConfirm")
                or ""
            )
            privacy_agree_value = (
                data.get("privacy_agree")
                or data.get("privacyAgree")
            )

            privacy_agreed = (
                privacy_agree_value is True
                or str(privacy_agree_value).lower()
                in ["true", "1", "on", "yes"]
            )

            if not name:
                return jsonify({"success": False, "message": "이름을 입력해 주세요."}), 400
            if len(name) > 20:
                return jsonify({"success": False, "message": "이름은 20자 이하로 입력해 주세요."}), 400
            if len(student_id) != 5 or not student_id.isdigit():
                return jsonify({"success": False, "message": "학번 5자리를 정확하게 입력해 주세요."}), 400
            if len(username) < 4:
                return jsonify({"success": False, "message": "아이디는 4자 이상이어야 합니다."}), 400
            if len(username) > 30:
                return jsonify({"success": False, "message": "아이디는 30자 이하로 입력해 주세요."}), 400
            if not username.replace("_", "").isalnum():
                return jsonify({"success": False, "message": "아이디는 영문, 숫자, 밑줄만 사용할 수 있습니다."}), 400
            if len(password) < 6:
                return jsonify({"success": False, "message": "비밀번호는 6자 이상이어야 합니다."}), 400
            if len(password) > 100:
                return jsonify({"success": False, "message": "비밀번호가 너무 깁니다."}), 400
            if password != password_confirm:
                return jsonify({"success": False, "message": "비밀번호 확인이 일치하지 않습니다."}), 400
            if not privacy_agreed:
                return jsonify({"success": False,"message": ("개인정보 수집 및 이용에 " "동의해야 회원가입할 수 있습니다."),}), 400
            if username_exists(username):
                return jsonify({"success": False, "message": "이미 사용 중인 아이디입니다."}), 409
            if student_id_exists(student_id):
                return jsonify({"success": False, "message": "해당 학번으로 이미 가입한 계정이 있습니다."}), 409

            password_hash = generate_password_hash(password)
            user = create_user(name, student_id, username, password_hash)
            if not user:
                raise RuntimeError("Supabase 사용자 저장 실패")

            return jsonify({
                "success": True,
                "message": "회원가입이 완료되었습니다.",
                "redirect": url_for("login"),
            }), 201

        except Exception as error:
            print("회원가입 오류:", repr(error))
            error_text = str(error).lower()
            if any(word in error_text for word in ["duplicate", "unique", "23505"]):
                return jsonify({"success": False, "message": "이미 사용 중인 정보입니다."}), 409

            return jsonify({
                "success": False,
                "message": "회원가입 처리 중 서버 오류가 발생했습니다.",
            }), 500

    @app.route(
        "/forgot-password",
        methods=["GET"],
        endpoint="forgot_password",
    )
    def forgot_password():
        if "user_id" in session:
            return redirect(url_for("dashboard"))

        return render_template("forgot_password.html")

    @app.route(
        "/api/forgot-password",
        methods=["POST"],
        endpoint="forgot_password_api",
    )
    def forgot_password_api():
        try:
            data = get_request_data()

            name = str(data.get("name") or "").strip()
            student_id = str(
                data.get("student_id") or ""
            ).strip()
            username = normalize_username(
                data.get("username")
            )

            if not name or not student_id or not username:
                return jsonify({
                    "success": False,
                    "message": "이름, 학번, 아이디를 모두 입력해 주세요.",
                }), 400

            if len(student_id) != 5 or not student_id.isdigit():
                return jsonify({
                    "success": False,
                    "message": "학번 5자리를 정확하게 입력해 주세요.",
                }), 400

            # 같은 브라우저에서 지나치게 반복 발급하는 것을 방지한다.
            now_timestamp = int(
                datetime.now(timezone.utc).timestamp()
            )
            last_reset_at = int(
                session.get("last_password_reset_at") or 0
            )

            if now_timestamp - last_reset_at < 60:
                wait_seconds = 60 - (
                    now_timestamp - last_reset_at
                )
                return jsonify({
                    "success": False,
                    "message": f"{wait_seconds}초 후 다시 시도해 주세요.",
                }), 429

            user = find_user_for_password_reset(
                name=name,
                student_id=student_id,
                username=username,
            )

            if not user:
                return jsonify({
                    "success": False,
                    "message": "입력한 회원 정보를 확인할 수 없습니다.",
                }), 404

            alphabet = (
                string.ascii_uppercase
                + string.ascii_lowercase
                + string.digits
            )
            temporary_password = "".join(
                secrets.choice(alphabet)
                for _ in range(10)
            )

            updated_user = reset_user_password(
                user_id=user["id"],
                password_hash=generate_password_hash(
                    temporary_password
                ),
            )

            if not updated_user:
                raise RuntimeError(
                    "임시 비밀번호 저장 결과가 없습니다."
                )

            session["last_password_reset_at"] = (
                now_timestamp
            )

            return jsonify({
                "success": True,
                "message": "임시 비밀번호가 발급되었습니다.",
                "temporary_password": temporary_password,
            }), 200

        except Exception as error:
            print("비밀번호 찾기 오류:", repr(error))
            return jsonify({
                "success": False,
                "message": "임시 비밀번호 발급 중 서버 오류가 발생했습니다.",
            }), 500

    @app.route("/api/logout", methods=["POST"], endpoint="api_logout")
    def api_logout():
        session.clear()
        return jsonify({"success": True})


    @app.route("/logout", endpoint="logout")
    def logout():
        session.clear()
        return redirect(url_for("login"))