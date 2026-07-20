from flask import Flask

from config import Config
from routes import register_routes
from utils.formatters import format_duration


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    app.jinja_env.filters["duration"] = format_duration
    register_routes(app)

    return app


app = create_app()


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=Config.PORT,
        debug=Config.FLASK_DEBUG,
    )
