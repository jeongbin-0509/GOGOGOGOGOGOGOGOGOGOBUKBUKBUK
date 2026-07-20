from datetime import date, datetime, timezone

from flask import jsonify, session

from services.study_service import (
    create_study_record,
    delete_study_record as delete_record,
    get_study_total,
    study_record_exists,
)
from utils.decorators import login_required
from utils.helpers import get_request_data, parse_int, today_iso


def register_study_routes(app):
    @app.route("/api/study-records", methods=["POST"], endpoint="save_study_record")
    @login_required
    def save_study_record():
        try:
            data = get_request_data()
            subject = str(data.get("subject") or "").strip()
            duration_seconds = parse_int(data.get("duration_seconds"))
            started_at = data.get("started_at")
            ended_at = data.get("ended_at")

            if not subject:
                return jsonify({"success": False, "message": "공부한 과목을 입력해 주세요."}), 400
            if len(subject) > 30:
                return jsonify({"success": False, "message": "과목명은 30자 이하로 입력해 주세요."}), 400
            if duration_seconds is None or duration_seconds < 10:
                return jsonify({"success": False, "message": "10초 이상 공부해야 기록할 수 있습니다."}), 400
            if duration_seconds > 57600:
                return jsonify({"success": False, "message": "한 번에 최대 16시간까지만 기록할 수 있습니다."}), 400

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

            if not create_study_record(insert_data):
                raise RuntimeError("공부 기록 저장 실패")

            today_seconds = get_study_total(session["user_id"], today_iso())
            return jsonify({
                "success": True,
                "message": "공부 기록이 저장되었습니다.",
                "today_seconds": today_seconds,
            }), 201

        except Exception as error:
            print("공부 기록 저장 오류:", repr(error))
            return jsonify({"success": False, "message": "공부 기록 저장 중 오류가 발생했습니다."}), 500

    @app.route("/api/study-records/manual", methods=["POST"], endpoint="save_manual_record")
    @login_required
    def save_manual_record():
        try:
            data = get_request_data()
            subject = str(data.get("subject") or "").strip()
            minutes = parse_int(data.get("minutes"))
            study_date = str(data.get("study_date") or today_iso())

            if not subject:
                return jsonify({"success": False, "message": "공부한 과목을 입력해 주세요."}), 400
            if len(subject) > 30:
                return jsonify({"success": False, "message": "과목명은 30자 이하로 입력해 주세요."}), 400
            if minutes is None or minutes < 1 or minutes > 960:
                return jsonify({"success": False, "message": "공부 시간은 1분 이상 960분 이하로 입력해 주세요."}), 400

            try:
                parsed_study_date = date.fromisoformat(study_date)
            except ValueError:
                return jsonify({"success": False, "message": "날짜 형식이 올바르지 않습니다."}), 400

            if parsed_study_date > date.today():
                return jsonify({"success": False, "message": "미래 날짜에는 기록할 수 없습니다."}), 400

            now_iso = datetime.now(timezone.utc).isoformat()
            record = {
                "user_id": session["user_id"],
                "subject": subject,
                "duration_seconds": minutes * 60,
                "study_date": study_date,
                "started_at": None,
                "ended_at": now_iso,
            }

            if not create_study_record(record):
                raise RuntimeError("공부 기록 저장 실패")

            return jsonify({
                "success": True,
                "message": "공부 기록이 저장되었습니다.",
            }), 201

        except Exception as error:
            print("직접 기록 저장 오류:", repr(error))
            return jsonify({"success": False, "message": "공부 기록 저장 중 오류가 발생했습니다."}), 500

    @app.route(
        "/api/study-records/<int:record_id>",
        methods=["DELETE"],
        endpoint="delete_study_record",
    )
    @login_required
    def delete_study_record(record_id):
        try:
            user_id = session["user_id"]
            if not study_record_exists(record_id, user_id):
                return jsonify({"success": False, "message": "공부 기록을 찾을 수 없습니다."}), 404

            delete_record(record_id, user_id)
            return jsonify({
                "success": True,
                "message": "공부 기록이 삭제되었습니다.",
            })

        except Exception as error:
            print("공부 기록 삭제 오류:", repr(error))
            return jsonify({"success": False, "message": "공부 기록 삭제 중 오류가 발생했습니다."}), 500
