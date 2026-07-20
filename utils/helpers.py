from datetime import date

from flask import request


def get_request_data():
    """JSON 요청과 일반 HTML form 요청을 모두 처리한다."""
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
