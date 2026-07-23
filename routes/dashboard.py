from datetime import datetime, timezone
import os

import requests
from flask import jsonify, request

from services.study_service import (
    get_recent_records,
    get_study_total,
)
from services.user_service import get_current_user
from utils.decorators import login_required
from utils.helpers import today_iso


# =========================================================
# Supabase REST 요청
# =========================================================
def _supabase_request(
    method,
    table,
    *,
    params=None,
    json_data=None,
):
    supabase_url = str(
        os.getenv("SUPABASE_URL") or ""
    ).rstrip("/")

    supabase_key = str(
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_KEY")
        or ""
    ).strip()

    if not supabase_url or not supabase_key:
        raise RuntimeError(
            "SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 없습니다."
        )

    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }

    response = requests.request(
        method=method,
        url=f"{supabase_url}/rest/v1/{table}",
        headers=headers,
        params=params,
        json=json_data,
        timeout=10,
    )

    if response.status_code >= 400:
        raise RuntimeError(
            f"Supabase REST 오류 "
            f"({response.status_code}): {response.text}"
        )

    if not response.text:
        return None

    return response.json()


def _normalize_records(records):
    normalized = []

    for record in records or []:
        item = dict(record)

        # dashboard.js는 subject_name을 사용하므로 맞춰 준다.
        item["subject_name"] = (
            item.get("subject_name")
            or item.get("subject")
            or "과목"
        )

        normalized.append(item)

    return normalized


def register_dashboard_routes(app):
    # =====================================================
    # 대시보드 전체 데이터
    # =====================================================
    @app.route(
        "/api/dashboard",
        methods=["GET"],
        endpoint="dashboard_api",
    )
    @login_required
    def dashboard_api():
        try:
            user = get_current_user()

            if not user:
                return jsonify({
                    "success": False,
                    "message": "로그인이 필요합니다.",
                    "redirect": "/login",
                }), 401

            user_id = user["id"]
            today = today_iso()

            subjects = _supabase_request(
                "GET",
                "study_subjects",
                params={
                    "select": "id,name,created_at",
                    "user_id": f"eq.{user_id}",
                    "order": "created_at.asc",
                },
            ) or []

            today_records = get_recent_records(
                user_id,
                limit=100,
            )

            # 최근 기록 함수가 다른 날짜 기록도 반환할 수 있으므로
            # 오늘 날짜만 남긴다.
            today_records = [
                record
                for record in today_records
                if str(record.get("study_date") or "") == today
            ]

            today_seconds = get_study_total(
                user_id,
                today,
            )

            total_seconds = get_study_total(
                user_id,
            )

            return jsonify({
                "success": True,

                "user": {
                    "id": user_id,
                    "name": (
                        user.get("name")
                        or user.get("username")
                        or "사용자"
                    ),
                    "student_number": (
                        user.get("student_number")
                        or user.get("usernum")
                    ),
                    "class_name": user.get("class_name"),
                },

                "subjects": subjects,

                "today_records": _normalize_records(
                    today_records
                ),

                "today_study_seconds": int(
                    today_seconds or 0
                ),

                "total_study_seconds": int(
                    total_seconds or 0
                ),

                # 현재는 진행 중 세션을 DB에 저장하지 않으므로 null
                "active_session": None,

                # 랭킹 기능이 아직 없다면 빈 값 반환
                "ranking": {
                    "personal_rank": None,
                    "class_rank": None,
                },
            }), 200

        except Exception as error:
            print("대시보드 조회 오류:", repr(error))

            return jsonify({
                "success": False,
                "message": (
                    "대시보드 데이터를 불러오는 중 "
                    "오류가 발생했습니다."
                ),
            }), 500

    # =====================================================
    # 과목 목록 조회
    # =====================================================
    @app.route(
        "/api/subjects",
        methods=["GET"],
        endpoint="get_subjects_api",
    )
    @login_required
    def get_subjects_api():
        try:
            user = get_current_user()

            if not user:
                return jsonify({
                    "success": False,
                    "message": "로그인이 필요합니다.",
                }), 401

            subjects = _supabase_request(
                "GET",
                "study_subjects",
                params={
                    "select": "id,name,created_at",
                    "user_id": f"eq.{user['id']}",
                    "order": "created_at.asc",
                },
            ) or []

            return jsonify({
                "success": True,
                "subjects": subjects,
            }), 200

        except Exception as error:
            print("과목 목록 조회 오류:", repr(error))

            return jsonify({
                "success": False,
                "message": "과목 목록을 불러오지 못했습니다.",
            }), 500

    # =====================================================
    # 과목 추가
    # =====================================================
    @app.route(
        "/api/subjects",
        methods=["POST"],
        endpoint="create_subject_api",
    )
    @login_required
    def create_subject_api():
        try:
            user = get_current_user()

            if not user:
                return jsonify({
                    "success": False,
                    "message": "로그인이 필요합니다.",
                }), 401

            data = request.get_json(silent=True) or {}
            name = str(data.get("name") or "").strip()

            if not name:
                return jsonify({
                    "success": False,
                    "message": "과목 이름을 입력해 주세요.",
                }), 400

            if len(name) > 20:
                return jsonify({
                    "success": False,
                    "message": "과목 이름은 20자 이하로 입력해 주세요.",
                }), 400

            existing = _supabase_request(
                "GET",
                "study_subjects",
                params={
                    "select": "id",
                    "user_id": f"eq.{user['id']}",
                    "name": f"eq.{name}",
                    "limit": "1",
                },
            ) or []

            if existing:
                return jsonify({
                    "success": False,
                    "message": "이미 등록된 과목입니다.",
                }), 409

            created = _supabase_request(
                "POST",
                "study_subjects",
                json_data={
                    "user_id": user["id"],
                    "name": name,
                    "created_at": (
                        datetime.now(timezone.utc).isoformat()
                    ),
                },
            )

            if not created:
                raise RuntimeError("과목 생성 결과가 없습니다.")

            subject = created[0]

            return jsonify({
                "success": True,
                "message": "과목이 추가되었습니다.",
                "subject": subject,
            }), 201

        except Exception as error:
            print("과목 추가 오류:", repr(error))

            error_text = str(error)

            if (
                "23505" in error_text
                or "duplicate key" in error_text.lower()
            ):
                return jsonify({
                    "success": False,
                    "message": "이미 등록된 과목입니다.",
                }), 409

            return jsonify({
                "success": False,
                "message": "과목을 추가하지 못했습니다.",
            }), 500

    # =====================================================
    # 과목 삭제
    # =====================================================
    @app.route(
        "/api/subjects/<subject_id>",
        methods=["DELETE"],
        endpoint="delete_subject_api",
    )
    @login_required
    def delete_subject_api(subject_id):
        try:
            user = get_current_user()

            if not user:
                return jsonify({
                    "success": False,
                    "message": "로그인이 필요합니다.",
                }), 401

            existing = _supabase_request(
                "GET",
                "study_subjects",
                params={
                    "select": "id,name",
                    "id": f"eq.{subject_id}",
                    "user_id": f"eq.{user['id']}",
                    "limit": "1",
                },
            ) or []

            if not existing:
                return jsonify({
                    "success": False,
                    "message": "과목을 찾을 수 없습니다.",
                }), 404

            _supabase_request(
                "DELETE",
                "study_subjects",
                params={
                    "id": f"eq.{subject_id}",
                    "user_id": f"eq.{user['id']}",
                },
            )

            return jsonify({
                "success": True,
                "message": "과목이 삭제되었습니다.",
            }), 200

        except Exception as error:
            print("과목 삭제 오류:", repr(error))

            return jsonify({
                "success": False,
                "message": "과목을 삭제하지 못했습니다.",
            }), 500