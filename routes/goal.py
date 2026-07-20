from flask import jsonify, session

from services.user_service import update_daily_goal
from utils.decorators import login_required
from utils.helpers import get_request_data, parse_float


def register_goal_routes(app):
    @app.route("/api/goal", methods=["POST"], endpoint="update_goal")
    @login_required
    def update_goal():
        try:
            data = get_request_data()
            hours = parse_float(data.get("hours"))

            if hours is None or hours < 0.5 or hours > 16:
                return jsonify({
                    "success": False,
                    "message": "목표시간은 0.5시간 이상 16시간 이하로 입력해 주세요.",
                }), 400

            goal_seconds = round(hours * 3600)
            if not update_daily_goal(session["user_id"], goal_seconds):
                raise RuntimeError("목표시간 변경 실패")

            return jsonify({
                "success": True,
                "message": "목표시간이 변경되었습니다.",
                "goal_seconds": goal_seconds,
            })

        except Exception as error:
            print("목표시간 변경 오류:", repr(error))
            return jsonify({"success": False, "message": "목표시간 변경 중 오류가 발생했습니다."}), 500
