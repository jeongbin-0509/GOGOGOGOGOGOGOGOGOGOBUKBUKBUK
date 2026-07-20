from flask import jsonify, redirect, render_template, request, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash

from services.user_service import (
    create_user,
    find_user_by_username,
    student_id_exists,
    username_exists,
)
from utils.helpers import get_request_data, normalize_username


def register_auth_routes(app):
    @app.route("/login", methods=["GET", "POST"], endpoint="login")
    def login():
        if request.method == "GET":
            if "user_id" in session:
                return redirect(url_for("index"))
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
            session.permanent = remember

            return jsonify({
                "success": True,
                "message": "로그인되었습니다.",
                "redirect": url_for("index"),
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
                return redirect(url_for("index"))
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

    @app.route("/logout", endpoint="logout")
    def logout():
        session.clear()
        return redirect(url_for("login"))
