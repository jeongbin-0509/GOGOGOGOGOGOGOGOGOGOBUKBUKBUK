from datetime import datetime, timezone
import os

import requests
from flask import jsonify, request

from services.study_service import (
    create_study_record,
    get_recent_records,
    get_study_record,
    get_study_total,
    update_daily_study_stats,
    update_study_record_duration,
)
from services.user_service import get_current_user
from utils.decorators import login_required
from utils.helpers import today_iso


def _to_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _supabase_rest_request(method, table, *, params=None, json=None):
    """Supabase REST API 요청을 수행한다.

    서버 환경변수의 service role key를 우선 사용하고, 없으면 기존
    SUPABASE_KEY를 사용한다. active_study_sessions 테이블의 RLS를
    활성화했다면 배포 환경에는 SUPABASE_SERVICE_ROLE_KEY가 필요하다.
    """
    supabase_url = str(os.getenv("SUPABASE_URL") or "").rstrip("/")
    supabase_key = str(
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_KEY")
        or ""
    ).strip()

    if not supabase_url or not supabase_key:
        raise RuntimeError(
            "SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다."
        )

    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=representation",
    }

    response = requests.request(
        method=method,
        url=f"{supabase_url}/rest/v1/{table}",
        headers=headers,
        params=params,
        json=json,
        timeout=10,
    )

    if response.status_code >= 400:
        raise RuntimeError(
            f"Supabase REST 오류 ({response.status_code}): {response.text}"
        )

    if not response.text:
        return None

    return response.json()


def register_study_routes(app):
    # =====================================================
    # 진행 중인 공부 세션 생성 또는 갱신
    # =====================================================
    @app.route(
        "/api/active-study-session",
        methods=["POST"],
        endpoint="upsert_active_study_session_api",
    )
    @login_required
    def upsert_active_study_session_api():
        try:
            user = get_current_user()

            if not user:
                return jsonify({
                    "success": False,
                    "message": "로그인이 필요합니다.",
                    "redirect": "/login",
                }), 401

            data = request.get_json(silent=True) or {}
            subject = str(data.get("subject") or "").strip()
            started_at = data.get("started_at")

            if not subject:
                return jsonify({
                    "success": False,
                    "message": "공부할 과목을 선택해 주세요.",
                }), 400

            if len(subject) > 30:
                return jsonify({
                    "success": False,
                    "message": "과목 이름은 30자 이하로 입력해 주세요.",
                }), 400

            if not started_at:
                started_at = datetime.now(timezone.utc).isoformat()

            now_iso = datetime.now(timezone.utc).isoformat()

            result = _supabase_rest_request(
                "POST",
                "active_study_sessions",
                params={
                    "on_conflict": "user_id",
                },
                json={
                    "user_id": user["id"],
                    "subject": subject,
                    "started_at": started_at,
                    "status": "studying",
                    "updated_at": now_iso,
                },
            )

            # upsert 결과를 반환받기 위해 Prefer 헤더가 필요하지만,
            # 여기서는 저장 성공 여부만 사용하므로 별도 조회 없이 처리한다.
            return jsonify({
                "success": True,
                "message": "공부할 과목을 DB에 저장했습니다.",
                "session": {
                    "user_id": user["id"],
                    "subject": subject,
                    "started_at": started_at,
                    "status": "studying",
                },
            }), 201

        except Exception as error:
            print("진행 중인 공부 세션 저장 오류:", repr(error))

            return jsonify({
                "success": False,
                "message": "공부할 과목을 DB에 저장하지 못했습니다.",
            }), 500

    # =====================================================
    # 진행 중인 공부 세션 삭제
    # =====================================================
    @app.route(
        "/api/active-study-session",
        methods=["DELETE"],
        endpoint="delete_active_study_session_api",
    )
    @login_required
    def delete_active_study_session_api():
        try:
            user = get_current_user()

            if not user:
                return jsonify({
                    "success": False,
                    "message": "로그인이 필요합니다.",
                    "redirect": "/login",
                }), 401

            _supabase_rest_request(
                "DELETE",
                "active_study_sessions",
                params={
                    "user_id": f"eq.{user['id']}",
                },
            )

            return jsonify({
                "success": True,
                "message": "진행 중인 공부 세션을 삭제했습니다.",
            }), 200

        except Exception as error:
            print("진행 중인 공부 세션 삭제 오류:", repr(error))

            return jsonify({
                "success": False,
                "message": "진행 중인 공부 세션을 삭제하지 못했습니다.",
            }), 500

    # =====================================================
    # 공부 기록 및 전체 공부시간 조회
    # =====================================================
    @app.route(
        "/api/study-summary",
        methods=["GET"],
        endpoint="study_summary_api",
    )
    @login_required
    def study_summary_api():
        try:
            user = get_current_user()

            if not user:
                return jsonify({
                    "success": False,
                    "message": (
                        "로그인이 필요합니다."
                    ),
                    "redirect": "/login",
                }), 401

            user_id = user["id"]
            today = today_iso()

            recent_records = get_recent_records(
                user_id,
                limit=10,
            )

            today_seconds = get_study_total(
                user_id,
                today,
            )

            total_seconds = get_study_total(
                user_id,
            )

            return jsonify({
                "success": True,
                "today_seconds": (
                    today_seconds
                ),
                "total_seconds": (
                    total_seconds
                ),
                "recent_records": (
                    recent_records
                ),
            }), 200

        except Exception as error:
            print(
                "공부 요약 조회 오류:",
                repr(error),
            )

            return jsonify({
                "success": False,
                "message": (
                    "공부 기록을 불러오는 중 "
                    "오류가 발생했습니다."
                ),
            }), 500

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
                return jsonify({
                    "success": False,
                    "message": (
                        "로그인이 필요합니다."
                    ),
                    "redirect": "/login",
                }), 401

            data = (
                request.get_json(
                    silent=True
                )
                or {}
            )

            subject = str(
                data.get("subject") or ""
            ).strip()

            duration_seconds = _to_int(
                data.get("duration_seconds"),
                default=0,
            )

            started_at = data.get(
                "started_at"
            )

            ended_at = data.get(
                "ended_at"
            )

            if not subject:
                return jsonify({
                    "success": False,
                    "message": (
                        "과목을 선택해 주세요."
                    ),
                }), 400

            if len(subject) > 30:
                return jsonify({
                    "success": False,
                    "message": (
                        "과목 이름은 30자 이하로 "
                        "입력해 주세요."
                    ),
                }), 400

            if duration_seconds < 10:
                return jsonify({
                    "success": False,
                    "message": (
                        "10초 이상 공부해야 "
                        "저장할 수 있습니다."
                    ),
                }), 400

            if duration_seconds > 24 * 3600:
                return jsonify({
                    "success": False,
                    "message": (
                        "한 번에 24시간을 초과해 "
                        "저장할 수 없습니다."
                    ),
                }), 400

            study_date = today_iso()

            if not ended_at:
                ended_at = datetime.now(
                    timezone.utc
                ).isoformat()

            record_data = {
                "user_id": user["id"],
                "subject": subject,
                "duration_seconds": (
                    duration_seconds
                ),
                "study_date": study_date,
                "started_at": started_at,
                "ended_at": ended_at,
            }

            record = create_study_record(
                record_data
            )

            if not record:
                return jsonify({
                    "success": False,
                    "message": (
                        "공부 기록 저장에 "
                        "실패했습니다."
                    ),
                }), 500

            daily_stats = (
                update_daily_study_stats(
                    user["id"],
                    study_date,
                )
            )

            total_seconds = get_study_total(
                user["id"]
            )

            return jsonify({
                "success": True,
                "message": (
                    "공부 기록이 저장되었습니다."
                ),
                "record": record,
                "daily_stats": daily_stats,
                "total_seconds": (
                    total_seconds
                ),
            }), 201

        except Exception as error:
            print(
                "공부 기록 생성 오류:",
                repr(error),
            )

            return jsonify({
                "success": False,
                "message": (
                    "공부 기록 저장 중 "
                    "오류가 발생했습니다."
                ),
            }), 500

    # =====================================================
    # 공부 기록 시간 수정
    # =====================================================
    @app.route(
        "/api/study-records/<record_id>",
        methods=["PATCH"],
        endpoint="update_study_record_api",
    )
    @login_required
    def update_study_record_api(record_id):
        try:
            user = get_current_user()

            if not user:
                return jsonify({
                    "success": False,
                    "message": (
                        "로그인이 필요합니다."
                    ),
                    "redirect": "/login",
                }), 401

            current_record = get_study_record(
                record_id,
                user["id"],
            )

            if not current_record:
                return jsonify({
                    "success": False,
                    "message": (
                        "공부 기록을 찾을 수 "
                        "없습니다."
                    ),
                }), 404

            data = (
                request.get_json(
                    silent=True
                )
                or {}
            )

            new_duration = _to_int(
                data.get("duration_seconds"),
                default=-1,
            )

            previous_duration = _to_int(
                current_record.get(
                    "duration_seconds"
                ),
                default=0,
            )

            if new_duration < 1:
                return jsonify({
                    "success": False,
                    "message": (
                        "공부시간은 최소 "
                        "1초 이상이어야 합니다."
                    ),
                }), 400

            if new_duration >= previous_duration:
                return jsonify({
                    "success": False,
                    "message": (
                        "공부시간은 기존 기록보다 "
                        "줄이는 것만 가능합니다."
                    ),
                }), 400

            update_result = (
                update_study_record_duration(
                    record_id=record_id,
                    user_id=user["id"],
                    duration_seconds=(
                        new_duration
                    ),
                )
            )

            study_date = str(
                current_record.get(
                    "study_date"
                )
                or today_iso()
            )

            updated_date_stats = (
                update_daily_study_stats(
                    user["id"],
                    study_date,
                )
            )

            today = today_iso()

            if study_date == today:
                today_stats = (
                    updated_date_stats
                )
            else:
                today_stats = (
                    update_daily_study_stats(
                        user["id"],
                        today,
                    )
                )

            total_seconds = get_study_total(
                user["id"]
            )

            return jsonify({
                "success": True,
                "message": (
                    "공부시간을 수정했습니다."
                ),
                "record": (
                    update_result["record"]
                ),
                "previous_duration_seconds": (
                    update_result[
                        "previous_duration_seconds"
                    ]
                ),
                "reduced_seconds": (
                    update_result[
                        "reduced_seconds"
                    ]
                ),
                "updated_date_stats": (
                    updated_date_stats
                ),
                "daily_stats": today_stats,
                "today_seconds": (
                    today_stats.get(
                        "total_seconds",
                        0,
                    )
                ),
                "total_seconds": (
                    total_seconds
                ),
            }), 200

        except LookupError as error:
            return jsonify({
                "success": False,
                "message": str(error),
            }), 404

        except ValueError as error:
            return jsonify({
                "success": False,
                "message": str(error),
            }), 400

        except Exception as error:
            print(
                "공부 기록 수정 오류:",
                repr(error),
            )

            return jsonify({
                "success": False,
                "message": (
                    "공부 기록 수정 중 "
                    "오류가 발생했습니다."
                ),
            }), 500