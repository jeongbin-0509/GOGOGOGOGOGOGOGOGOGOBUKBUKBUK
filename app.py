from __future__ import annotations

import os
import sqlite3
from datetime import date, datetime, timezone
from functools import wraps
from pathlib import Path

from flask import Flask, flash, g, jsonify, redirect, render_template, request, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash

BASE_DIR = Path(__file__).resolve().parent
DATABASE = BASE_DIR / "study.db"

app = Flask(__name__)
app.config.update(
    SECRET_KEY=os.getenv("SECRET_KEY", "change-this-secret-key"),
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
)


def get_db() -> sqlite3.Connection:
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


@app.teardown_appcontext
def close_db(_error: BaseException | None) -> None:
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db() -> None:
    db = sqlite3.connect(DATABASE)
    db.executescript(
        """
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 3),
            class_no INTEGER NOT NULL CHECK (class_no BETWEEN 1 AND 20),
            student_no INTEGER NOT NULL CHECK (student_no BETWEEN 1 AND 50),
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            daily_goal_seconds INTEGER NOT NULL DEFAULT 28800,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS study_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            subject TEXT NOT NULL,
            duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
            study_date TEXT NOT NULL,
            started_at TEXT,
            ended_at TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_records_user_date
        ON study_records(user_id, study_date);
        """
    )
    db.close()


def login_required(view):
    @wraps(view)
    def wrapped_view(*args, **kwargs):
        if "user_id" not in session:
            return redirect(url_for("login"))
        return view(*args, **kwargs)

    return wrapped_view


def current_user():
    user_id = session.get("user_id")
    if not user_id:
        return None
    return get_db().execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()


def seconds_to_hms(total_seconds: int) -> str:
    total_seconds = max(0, int(total_seconds))
    hours, remainder = divmod(total_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


def seconds_to_hm(total_seconds: int) -> str:
    total_seconds = max(0, int(total_seconds))
    hours, remainder = divmod(total_seconds, 3600)
    minutes = remainder // 60
    return f"{hours:02d}:{minutes:02d}"


@app.route("/")
def root():
    return redirect(url_for("home") if session.get("user_id") else url_for("login"))


@app.route("/signup", methods=["GET", "POST"])
def signup():
    if request.method == "GET":
        return render_template("signup.html")

    name = request.form.get("name", "").strip()
    username = request.form.get("username", "").strip()
    password = request.form.get("password", "")
    password_confirm = request.form.get("password_confirm", "")
    terms = request.form.get("terms")
    privacy = request.form.get("privacy")

    try:
        grade = int(request.form.get("grade", ""))
        class_no = int(request.form.get("class_no", ""))
        student_no = int(request.form.get("student_no", ""))
    except ValueError:
        flash("학년, 반, 번호는 숫자로 입력해 주세요.", "error")
        return render_template("signup.html"), 400

    if not all([name, username, password, password_confirm]):
        flash("모든 항목을 입력해 주세요.", "error")
        return render_template("signup.html"), 400
    if not (1 <= grade <= 3 and 1 <= class_no <= 20 and 1 <= student_no <= 50):
        flash("학년, 반, 번호를 올바르게 입력해 주세요.", "error")
        return render_template("signup.html"), 400
    if len(username) < 4:
        flash("아이디는 4자 이상이어야 합니다.", "error")
        return render_template("signup.html"), 400
    if len(password) < 6:
        flash("비밀번호는 6자 이상이어야 합니다.", "error")
        return render_template("signup.html"), 400
    if password != password_confirm:
        flash("비밀번호 확인이 일치하지 않습니다.", "error")
        return render_template("signup.html"), 400
    if not terms or not privacy:
        flash("이용약관과 개인정보 처리방침에 동의해 주세요.", "error")
        return render_template("signup.html"), 400

    db = get_db()
    try:
        db.execute(
            """
            INSERT INTO users(name, grade, class_no, student_no, username, password_hash)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (name, grade, class_no, student_no, username, generate_password_hash(password)),
        )
        db.commit()
    except sqlite3.IntegrityError:
        flash("이미 사용 중인 아이디입니다.", "error")
        return render_template("signup.html"), 409

    flash("회원가입이 완료되었습니다. 로그인해 주세요.", "success")
    return redirect(url_for("login"))


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "GET":
        return render_template("login.html")

    username = request.form.get("username", "").strip()
    password = request.form.get("password", "")
    user = get_db().execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()

    if user is None or not check_password_hash(user["password_hash"], password):
        flash("아이디 또는 비밀번호가 올바르지 않습니다.", "error")
        return render_template("login.html"), 401

    session.clear()
    session["user_id"] = user["id"]
    session.permanent = bool(request.form.get("remember"))
    return redirect(url_for("home"))


@app.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/home")
@login_required
def home():
    user = current_user()
    db = get_db()
    today = date.today().isoformat()

    today_rows = db.execute(
        """
        SELECT subject, duration_seconds, started_at, ended_at
        FROM study_records
        WHERE user_id = ? AND study_date = ?
        ORDER BY id DESC
        """,
        (user["id"], today),
    ).fetchall()

    today_seconds = sum(row["duration_seconds"] for row in today_rows)
    total_seconds = db.execute(
        "SELECT COALESCE(SUM(duration_seconds), 0) AS total FROM study_records WHERE user_id = ?",
        (user["id"],),
    ).fetchone()["total"]

    rank_rows = db.execute(
        """
        SELECT u.id, COALESCE(SUM(r.duration_seconds), 0) AS total
        FROM users u
        LEFT JOIN study_records r ON r.user_id = u.id
        GROUP BY u.id
        ORDER BY total DESC, u.id ASC
        """
    ).fetchall()
    personal_rank = next((idx + 1 for idx, row in enumerate(rank_rows) if row["id"] == user["id"]), 1)

    class_rows = db.execute(
        """
        SELECT u.grade, u.class_no,
               COALESCE(SUM(r.duration_seconds), 0) AS total,
               COUNT(DISTINCT u.id) AS students
        FROM users u
        LEFT JOIN study_records r ON r.user_id = u.id
        GROUP BY u.grade, u.class_no
        ORDER BY (1.0 * total / students) DESC, u.grade, u.class_no
        """
    ).fetchall()
    class_rank = next(
        (idx + 1 for idx, row in enumerate(class_rows)
         if row["grade"] == user["grade"] and row["class_no"] == user["class_no"]),
        1,
    )

    goal = user["daily_goal_seconds"]
    progress = min(100, round(today_seconds / goal * 100)) if goal else 0

    records = [
        {"subject": row["subject"], "duration": seconds_to_hm(row["duration_seconds"])}
        for row in today_rows
    ]

    return render_template(
        "index.html",
        user=user,
        today_seconds=today_seconds,
        today_hms=seconds_to_hms(today_seconds),
        total_hours=round(total_seconds / 3600, 1),
        progress=progress,
        personal_rank=personal_rank,
        class_rank=class_rank,
        records=records,
    )


@app.post("/api/study-records")
@login_required
def create_study_record():
    data = request.get_json(silent=True) or {}
    subject = str(data.get("subject", "")).strip()

    try:
        duration_seconds = int(data.get("duration_seconds", 0))
    except (TypeError, ValueError):
        duration_seconds = 0

    if not subject:
        return jsonify(ok=False, message="공부한 과목을 입력해 주세요."), 400
    if duration_seconds < 10:
        return jsonify(ok=False, message="10초 이상 공부한 기록만 저장할 수 있습니다."), 400
    if duration_seconds > 16 * 3600:
        return jsonify(ok=False, message="한 번에 16시간을 초과해 저장할 수 없습니다."), 400

    started_at = data.get("started_at")
    ended_at = data.get("ended_at")
    now = datetime.now(timezone.utc).isoformat()

    db = get_db()
    db.execute(
        """
        INSERT INTO study_records(user_id, subject, duration_seconds, study_date, started_at, ended_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (session["user_id"], subject, duration_seconds, date.today().isoformat(), started_at, ended_at or now),
    )
    db.commit()
    return jsonify(ok=True, redirect=url_for("home")), 201


@app.post("/api/manual-records")
@login_required
def create_manual_record():
    data = request.get_json(silent=True) or {}
    subject = str(data.get("subject", "")).strip()
    try:
        minutes = int(data.get("minutes", 0))
    except (TypeError, ValueError):
        minutes = 0

    if not subject or minutes <= 0:
        return jsonify(ok=False, message="과목과 공부 시간을 올바르게 입력해 주세요."), 400
    if minutes > 960:
        return jsonify(ok=False, message="하루 16시간을 초과해 입력할 수 없습니다."), 400

    db = get_db()
    db.execute(
        """
        INSERT INTO study_records(user_id, subject, duration_seconds, study_date)
        VALUES (?, ?, ?, ?)
        """,
        (session["user_id"], subject, minutes * 60, date.today().isoformat()),
    )
    db.commit()
    return jsonify(ok=True, redirect=url_for("home")), 201


@app.post("/api/goal")
@login_required
def update_goal():
    data = request.get_json(silent=True) or {}
    try:
        hours = float(data.get("hours", 0))
    except (TypeError, ValueError):
        hours = 0
    if not 0.5 <= hours <= 16:
        return jsonify(ok=False, message="목표 시간은 0.5~16시간 사이여야 합니다."), 400
    db = get_db()
    db.execute("UPDATE users SET daily_goal_seconds = ? WHERE id = ?", (int(hours * 3600), session["user_id"]))
    db.commit()
    return jsonify(ok=True), 200


@app.context_processor
def utility_processor():
    return {"seconds_to_hm": seconds_to_hm}


init_db()

if __name__ == "__main__":
    app.run(debug=True)
