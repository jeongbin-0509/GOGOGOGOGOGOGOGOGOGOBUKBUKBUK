from datetime import datetime, timezone

from flask import jsonify, request

from services.study_service import (
    create_study_record,
    delete_study_record,
    study_record_exists,
    update_daily_study_stats,
)
from services.user_service import get_current_user
from utils.decorators import login_required
from utils.helpers import today_iso


def register_study_routes(app):
    # =====================================================
    # 공부 기록 생성
    # =====================================================
    @app.route(
        "/api/study-records",
        methods=["POST"],
        endpoint="create_study_record_api",
    )
    @login_required
    def create_study_record_api():
        try:
            user = get_current_user()

            if not user:
                return jsonify(
                    {
                        "success": False,
                        "message": "로그인이 필요합니다.",
                        "redirect": "/login",
                    }
                ), 401

            data = request.get_json(silent=True) or {}

            subject = str(
                data.get("subject") or ""
            ).strip()

            try:
                duration_seconds = int(
                    data.get("duration_seconds") or 0
                )
            except (TypeError, ValueError):
                duration_seconds = 0

            started_at = data.get("started_at")
            ended_at = data.get("ended_at")

            if not subject:
                return jsonify(
                    {
                        "success": False,
                        "message": "과목을 선택해 주세요.",
                    }
                ), 400

            if len(subject) > 30:
                return jsonify(
                    {
                        "success": False,
                        "message": "과목 이름은 30자 이하로 입력해 주세요.",
                    }
                ), 400

            if duration_seconds < 10:
                return jsonify(
                    {
                        "success": False,
                        "message": "10초 이상 공부해야 저장할 수 있습니다.",
                    }
                ), 400

            if duration_seconds > 24 * 3600:
                return jsonify(
                    {
                        "success": False,
                        "message": "한 번에 24시간을 초과해 저장할 수 없습니다.",
                    }
                ), 400

            study_date = today_iso()

            if not ended_at:
                ended_at = datetime.now(
                    timezone.utc
                ).isoformat()

            record_data = {
                "user_id": user["id"],
                "subject": subject,
                "duration_seconds": duration_seconds,
                "study_date": study_date,
                "started_at": started_at,
                "ended_at": ended_at,
            }

            record = create_study_record(
                record_data
            )

            if not record:
                return jsonify(
                    {
                        "success": False,
                        "message": "공부 기록 저장에 실패했습니다.",
                    }
                ), 500

            daily_stats = update_daily_study_stats(
                user["id"],
                study_date,
            )

            return jsonify(
                {
                    "success": True,
                    "message": "공부 기록이 저장되었습니다.",
                    "record": record,
                    "daily_stats": daily_stats,
                }
            ), 201

        except Exception as error:
            print(
                "공부 기록 생성 오류:",
                repr(error),
            )

            return jsonify(
                {
                    "success": False,
                    "message": "공부 기록 저장 중 오류가 발생했습니다.",
                }
            ), 500

    # =====================================================
    # 공부 기록 삭제
    # =====================================================
    @app.route(
        "/api/study-records/<record_id>",
        methods=["DELETE"],
        endpoint="delete_study_record_api",
    )
    @login_required
    def delete_study_record_api(record_id):
        try:
            user = get_current_user()

            if not user:
                return jsonify(
                    {
                        "success": False,
                        "message": "로그인이 필요합니다.",
                        "redirect": "/login",
                    }
                ), 401

            exists = study_record_exists(
                record_id,
                user["id"],
            )

            if not exists:
                return jsonify(
                    {
                        "success": False,
                        "message": "공부 기록을 찾을 수 없습니다.",
                    }
                ), 404

            delete_study_record(
                record_id,
                user["id"],
            )

            daily_stats = update_daily_study_stats(
                user["id"],
                today_iso(),
            )

            return jsonify(
                {
                    "success": True,
                    "message": "공부 기록이 삭제되었습니다.",
                    "daily_stats": daily_stats,
                }
            )

        except Exception as error:
            print(
                "공부 기록 삭제 오류:",
                repr(error),
            )

            return jsonify(
                {
                    "success": False,
                    "message": "공부 기록 삭제 중 오류가 발생했습니다.",
                }
            ), 500