from functools import wraps

from flask import jsonify, redirect, request, session, url_for


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
