from routes.auth import register_auth_routes
from routes.dashboard import register_dashboard_routes
from routes.errors import register_error_handlers
from routes.goal import register_goal_routes
from routes.main import register_main_routes
from routes.study import register_study_routes


def register_routes(app):
    register_auth_routes(app)
    register_main_routes(app)
    register_study_routes(app)
    register_dashboard_routes(app)
    register_goal_routes(app)
    register_error_handlers(app)