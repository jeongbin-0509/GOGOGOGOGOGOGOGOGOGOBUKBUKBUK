from flask import jsonify, request


def register_error_handlers(app):
    @app.errorhandler(404)
    def not_found(error):
        if request.path.startswith("/api/"):
            return jsonify({
                "success": False,
                "message": "요청한 API를 찾을 수 없습니다.",
            }), 404
        return "페이지를 찾을 수 없습니다.", 404

    @app.errorhandler(405)
    def method_not_allowed(error):
        if request.path.startswith("/api/") or request.path in ["/login", "/signup"]:
            return jsonify({
                "success": False,
                "message": "허용되지 않은 요청 방식입니다.",
            }), 405
        return "허용되지 않은 요청입니다.", 405
