(() => {
    "use strict";

    // =========================================================
    // 1. Page Data / Config
    // =========================================================

    const pageData = window.FOCUS_PAGE_DATA || {};

    function firstDefined(...values) {
        return values.find(
            value => value !== undefined && value !== null && value !== ""
        );
    }

    function toFiniteNumber(value, fallback = 0) {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    const CONFIG = {
        subject: String(
            firstDefined(
                pageData.subject,
                pageData.studySubject,
                document.body?.dataset?.subject,
                "기타"
            )
        ),

        todaySeconds: Math.max(
            0,
            toFiniteNumber(
                firstDefined(
                    pageData.todaySeconds,
                    pageData.today_seconds,
                    pageData.todayStudySeconds,
                    0
                )
            )
        ),

        goalSeconds: Math.max(
            1,
            toFiniteNumber(
                firstDefined(
                    pageData.goalSeconds,
                    pageData.goal_seconds,
                    pageData.dailyGoalSeconds,
                    8 * 60 * 60
                )
            )
        ),

        dashboardUrl: String(
            firstDefined(
                pageData.dashboardUrl,
                pageData.dashboard_url,
                "/"
            )
        ),

        saveRecordUrl: String(
            firstDefined(
                pageData.saveRecordUrl,
                pageData.save_record_url,
                "/api/study-records"
            )
        ),

        storageKey: String(
            firstDefined(
                pageData.storageKey,
                pageData.storage_key,
                "activeStudySession"
            )
        ),

        minimumSaveSeconds: Math.max(
            0,
            toFiniteNumber(
                firstDefined(
                    pageData.minimumSaveSeconds,
                    pageData.minimum_save_seconds,
                    1
                )
            )
        )
    };

    // =========================================================
    // 2. DOM
    // =========================================================

    function byId(...ids) {
        for (const id of ids) {
            const element = document.getElementById(id);
            if (element) return element;
        }
        return null;
    }

    const DOM = {
        timer: byId("focusTimer", "focus-timer"),
        todayTotal: byId("focusTodayTotal", "focus-today-total"),
        goalText: byId("focusGoalText", "focus-goal-text"),
        goalRate: byId("focusGoalRate", "focus-goal-rate"),
        goalProgress: byId("focusGoalProgress", "focus-goal-progress"),
        goalProgressBar: byId(
            "focusGoalProgressBar",
            "focus-goal-progress-bar"
        ),
        grade: byId("focusGrade", "focus-grade"),
        gradeMessage: byId(
            "focusGradeMessage",
            "focus-grade-message"
        ),
        status: byId(
            "focusStatus",
            "focus-status",
            "studyStatus",
            "study-status"
        ),

        dashboardButton: byId(
            "dashboardButton",
            "dashboardBtn",
            "backButton",
            "backBtn",
            "focusDashboardButton",
            "focus-dashboard-button"
        ),

        dashboardLink: byId(
            "dashboardLink",
            "backLink",
            "focusDashboardLink",
            "focus-dashboard-link"
        ),

        stopButton: byId(
            "stopStudyButton",
            "stopButton",
            "stopBtn",
            "focusStopButton",
            "focus-stop-button"
        ),

        stopModal: byId(
            "stopModal",
            "stopStudyModal",
            "focusStopModal",
            "focus-stop-modal"
        ),

        stopBackdrop: byId(
            "stopBackdrop",
            "modalBackdrop",
            "focusStopBackdrop",
            "focus-stop-backdrop"
        ),

        cancelStop: byId(
            "cancelStop",
            "cancelStopButton",
            "stopCancelButton",
            "focusCancelStop",
            "focus-cancel-stop"
        ),

        confirmStop: byId(
            "confirmStop",
            "confirmStopButton",
            "stopConfirmButton",
            "focusConfirmStop",
            "focus-confirm-stop"
        ),

        message: byId(
            "focusMessage",
            "focus-message",
            "studyMessage",
            "study-message"
        )
    };

    // =========================================================
    // 3. State
    // =========================================================

    let session = null;
    let timerInterval = null;
    let isSaving = false;
    let eventsBound = false;

    // =========================================================
    // 4. Utilities
    // =========================================================

    function formatTime(totalSeconds) {
        const seconds = Math.max(0, Math.floor(toFiniteNumber(totalSeconds)));
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;

        return [
            String(hours).padStart(2, "0"),
            String(minutes).padStart(2, "0"),
            String(remainingSeconds).padStart(2, "0")
        ].join(":");
    }

    function setText(element, value) {
        if (element) {
            element.textContent = String(value);
        }
    }

    function showElement(element) {
        if (!element) return;
        element.hidden = false;
        element.classList.add("is-open");
        element.setAttribute("aria-hidden", "false");
    }

    function hideElement(element) {
        if (!element) return;
        element.hidden = true;
        element.classList.remove("is-open");
        element.setAttribute("aria-hidden", "true");
    }

    function showMessage(message, type = "error") {
        if (!DOM.message) {
            if (type === "error") {
                console.error(message);
            } else {
                console.log(message);
            }
            return;
        }

        DOM.message.hidden = false;
        DOM.message.dataset.type = type;
        DOM.message.textContent = String(message);
    }

    function hideMessage() {
        if (!DOM.message) return;
        DOM.message.hidden = true;
        DOM.message.textContent = "";
        delete DOM.message.dataset.type;
    }

    async function parseResponse(response) {
        const contentType = response.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
            return response.json();
        }

        const text = await response.text();

        return {
            success: response.ok,
            message: text || null
        };
    }

    // =========================================================
    // 5. Study Session
    // =========================================================

    class StudySession {
        constructor(subject) {
            this.subject = subject;
            this.startedAt = Date.now();
            this.isPaused = false;
            this.pausedAt = null;
            this.totalPausedMilliseconds = 0;
            this.automaticallyPaused = false;
        }

        get elapsedMilliseconds() {
            const endTime =
                this.isPaused && this.pausedAt
                    ? this.pausedAt
                    : Date.now();

            return Math.max(
                0,
                endTime -
                    this.startedAt -
                    this.totalPausedMilliseconds
            );
        }

        get elapsedSeconds() {
            return Math.floor(this.elapsedMilliseconds / 1000);
        }

        pause(automaticallyPaused = false) {
            if (this.isPaused) return;

            this.isPaused = true;
            this.pausedAt = Date.now();
            this.automaticallyPaused = automaticallyPaused;
        }

        resume() {
            if (!this.isPaused) return;

            if (this.pausedAt) {
                this.totalPausedMilliseconds += Math.max(
                    0,
                    Date.now() - this.pausedAt
                );
            }

            this.isPaused = false;
            this.pausedAt = null;
            this.automaticallyPaused = false;
        }

        toJSON() {
            return {
                version: 1,
                subject: this.subject,
                startedAt: this.startedAt,
                isPaused: this.isPaused,
                pausedAt: this.pausedAt,
                totalPausedMilliseconds:
                    this.totalPausedMilliseconds,
                automaticallyPaused: this.automaticallyPaused
            };
        }

        static fromJSON(data) {
            if (!data || typeof data !== "object") {
                return null;
            }

            const restored = new StudySession(
                String(data.subject || CONFIG.subject)
            );

            restored.startedAt = toFiniteNumber(
                data.startedAt,
                Date.now()
            );

            restored.isPaused = Boolean(data.isPaused);

            restored.pausedAt =
                data.pausedAt === null ||
                data.pausedAt === undefined
                    ? null
                    : toFiniteNumber(data.pausedAt, null);

            restored.totalPausedMilliseconds = Math.max(
                0,
                toFiniteNumber(
                    firstDefined(
                        data.totalPausedMilliseconds,
                        data.totalPaused,
                        0
                    )
                )
            );

            restored.automaticallyPaused = Boolean(
                data.automaticallyPaused
            );

            if (restored.isPaused && !restored.pausedAt) {
                restored.pausedAt = Date.now();
            }

            return restored;
        }
    }

    // =========================================================
    // 6. Local Storage
    // =========================================================

    function saveSession() {
        if (!session) return;

        try {
            localStorage.setItem(
                CONFIG.storageKey,
                JSON.stringify(session.toJSON())
            );
        } catch (error) {
            console.error("공부 세션 저장 실패:", error);
        }
    }

    function loadSession() {
        try {
            const raw = localStorage.getItem(CONFIG.storageKey);

            if (!raw) return null;

            const data = JSON.parse(raw);

            if (
                data.subject &&
                String(data.subject) !== CONFIG.subject
            ) {
                return null;
            }

            return StudySession.fromJSON(data);
        } catch (error) {
            console.error("공부 세션 복원 실패:", error);
            return null;
        }
    }

    function removeSession() {
        try {
            localStorage.removeItem(CONFIG.storageKey);
        } catch (error) {
            console.error("공부 세션 삭제 실패:", error);
        }
    }

    // =========================================================
    // 7. Time / Grade
    // =========================================================

    function getCurrentStudySeconds() {
        return session ? session.elapsedSeconds : 0;
    }

    function getTodayStudySeconds() {
        return CONFIG.todaySeconds + getCurrentStudySeconds();
    }

    function calculateGrade(seconds) {
        if (seconds >= 12 * 3600) {
            return {
                grade: 1,
                message: "오늘 12시간 이상 공부했습니다."
            };
        }

        if (seconds >= 8 * 3600) {
            return {
                grade: 2,
                message: "현재 2등급입니다."
            };
        }

        if (seconds >= 5 * 3600) {
            return {
                grade: 3,
                message: "현재 3등급입니다."
            };
        }

        if (seconds >= 3 * 3600) {
            return {
                grade: 4,
                message: "현재 4등급입니다."
            };
        }

        return {
            grade: 5,
            message: "3시간 이상 공부하면 4등급입니다."
        };
    }

    // =========================================================
    // 8. UI
    // =========================================================

    function updateStatusUI() {
        if (!session || !DOM.status) return;

        if (session.isPaused) {
            DOM.status.textContent = "일시정지";
            DOM.status.classList.remove(
                "focus-status-running",
                "is-running"
            );
            DOM.status.classList.add(
                "focus-status-paused",
                "is-paused"
            );
        } else {
            DOM.status.textContent = "공부 중";
            DOM.status.classList.remove(
                "focus-status-paused",
                "is-paused"
            );
            DOM.status.classList.add(
                "focus-status-running",
                "is-running"
            );
        }
    }

    function updateTimerUI() {
        if (!session) return;

        const currentSeconds = getCurrentStudySeconds();
        const todaySeconds = getTodayStudySeconds();
        const goalSeconds = CONFIG.goalSeconds;

        const rawPercent =
            goalSeconds > 0
                ? (todaySeconds / goalSeconds) * 100
                : 0;

        const percent = Math.max(
            0,
            Math.min(100, Math.round(rawPercent))
        );

        setText(DOM.timer, formatTime(currentSeconds));
        setText(DOM.todayTotal, formatTime(todaySeconds));

        setText(
            DOM.goalText,
            `${formatTime(todaySeconds)} / ${formatTime(
                goalSeconds
            )}`
        );

        setText(DOM.goalRate, `${percent}%`);

        const progressElement =
            DOM.goalProgressBar || DOM.goalProgress;

        if (progressElement) {
            progressElement.style.width = `${percent}%`;
            progressElement.setAttribute(
                "aria-valuenow",
                String(percent)
            );
            progressElement.setAttribute(
                "aria-valuemin",
                "0"
            );
            progressElement.setAttribute(
                "aria-valuemax",
                "100"
            );
        }

        const grade = calculateGrade(todaySeconds);

        setText(DOM.grade, `${grade.grade}등급`);
        setText(DOM.gradeMessage, grade.message);
        updateStatusUI();
    }

    // =========================================================
    // 9. Timer
    // =========================================================

    function stopTimer() {
        if (timerInterval !== null) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    function startTimer() {
        stopTimer();
        updateTimerUI();

        timerInterval = window.setInterval(() => {
            updateTimerUI();

            if (session && !session.isPaused) {
                saveSession();
            }
        }, 1000);
    }

    function pauseStudy(automaticallyPaused = false) {
        if (!session || session.isPaused) return;

        session.pause(automaticallyPaused);
        saveSession();
        updateTimerUI();
    }

    function resumeStudy() {
        if (!session || !session.isPaused) return;

        session.resume();
        saveSession();
        updateTimerUI();
    }

    // =========================================================
    // 10. Dashboard
    // =========================================================

    function moveDashboard(event) {
        event?.preventDefault();

        if (isSaving) return;

        // 대시보드로 이동해도 공부시간은 계속 흐른다.
        // startedAt 기준으로 계산하므로 브라우저 종료, 화면 꺼짐,
        // 기기 재부팅 후 다시 접속해도 지난 시간이 반영된다.
        saveSession();

        window.location.href = CONFIG.dashboardUrl;
    }

    // =========================================================
    // 11. Stop Modal
    // =========================================================

    function openStopModal(event) {
        event?.preventDefault();
        hideMessage();

        if (!DOM.stopModal) {
            const confirmed = window.confirm(
                "공부를 종료하고 기록을 저장할까요?"
            );

            if (confirmed) {
                saveStudyRecord();
            }

            return;
        }

        showElement(DOM.stopModal);
        document.body.style.overflow = "hidden";

        DOM.confirmStop?.focus();
    }

    function closeStopModal(event) {
        event?.preventDefault();

        hideElement(DOM.stopModal);
        document.body.style.overflow = "";
        DOM.stopButton?.focus();
    }

    // =========================================================
    // 12. API Save
    // =========================================================

    async function saveStudyRecord(event) {
        event?.preventDefault();

        if (!session || isSaving) return;

        isSaving = true;
        hideMessage();

        const wasPaused = session.isPaused;

        if (!wasPaused) {
            pauseStudy(false);
        }

        stopTimer();

        const durationSeconds = getCurrentStudySeconds();

        if (
            durationSeconds <
            CONFIG.minimumSaveSeconds
        ) {
            showMessage(
                `${CONFIG.minimumSaveSeconds}초 이상 공부해야 저장됩니다.`
            );

            isSaving = false;

            if (!wasPaused) {
                resumeStudy();
            }

            startTimer();
            return;
        }

        const endedAt = new Date();
        const startedAt = new Date(session.startedAt);

        const requestBody = {
            subject: CONFIG.subject,

            // 백엔드 구현마다 이름이 다를 수 있어 두 형식을 함께 전송한다.
            duration_seconds: durationSeconds,
            durationSeconds: durationSeconds,

            started_at: startedAt.toISOString(),
            startedAt: startedAt.toISOString(),

            ended_at: endedAt.toISOString(),
            endedAt: endedAt.toISOString()
        };

        try {
            if (DOM.confirmStop) {
                DOM.confirmStop.disabled = true;
            }

            const response = await fetch(
                CONFIG.saveRecordUrl,
                {
                    method: "POST",
                    credentials: "same-origin",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json"
                    },
                    body: JSON.stringify(requestBody)
                }
            );

            const result = await parseResponse(response);

            if (!response.ok || result?.success === false) {
                throw new Error(
                    result?.message ||
                        result?.error ||
                        `공부 기록 저장에 실패했습니다. (${response.status})`
                );
            }

            removeSession();
            closeStopModal();

            window.location.replace(CONFIG.dashboardUrl);
        } catch (error) {
            console.error("공부 기록 저장 실패:", error);

            showMessage(
                error instanceof Error
                    ? error.message
                    : "공부 기록 저장 중 오류가 발생했습니다."
            );

            if (!wasPaused) {
                resumeStudy();
            }

            startTimer();
        } finally {
            isSaving = false;

            if (DOM.confirmStop) {
                DOM.confirmStop.disabled = false;
            }
        }
    }

    // =========================================================
    // 13. Page Lifecycle
    // =========================================================

    function handleVisibilityChange() {
        if (!session) return;

        if (document.hidden) {
            saveSession();
            return;
        }

        const storedSession = loadSession();

        if (storedSession) {
            session = storedSession;
        }

        updateTimerUI();
    }

    function handlePageShow() {
        const storedSession = loadSession();

        if (storedSession) {
            session = storedSession;
        }

        updateTimerUI();
        startTimer();
    }

    function handlePageHide() {
        saveSession();
    }

    function handleBeforeUnload() {
        saveSession();
    }

    function handleStorageChange(event) {
        if (event.key !== CONFIG.storageKey) return;

        if (!event.newValue) {
            return;
        }

        try {
            const data = JSON.parse(event.newValue);
            const restored = StudySession.fromJSON(data);

            if (restored) {
                session = restored;
                updateTimerUI();
            }
        } catch (error) {
            console.error("다른 탭의 공부 세션 동기화 실패:", error);
        }
    }

    // =========================================================
    // 14. Events
    // =========================================================

    function bindEvents() {
        if (eventsBound) return;
        eventsBound = true;

        DOM.dashboardButton?.addEventListener(
            "click",
            moveDashboard
        );

        DOM.dashboardLink?.addEventListener(
            "click",
            moveDashboard
        );

        DOM.stopButton?.addEventListener(
            "click",
            openStopModal
        );

        DOM.cancelStop?.addEventListener(
            "click",
            closeStopModal
        );

        DOM.stopBackdrop?.addEventListener(
            "click",
            closeStopModal
        );

        DOM.confirmStop?.addEventListener(
            "click",
            saveStudyRecord
        );

        DOM.stopModal?.addEventListener("click", event => {
            if (event.target === DOM.stopModal) {
                closeStopModal(event);
            }
        });

        document.addEventListener(
            "keydown",
            event => {
                if (
                    event.key === "Escape" &&
                    DOM.stopModal &&
                    !DOM.stopModal.hidden
                ) {
                    closeStopModal(event);
                }
            }
        );

        document.addEventListener(
            "visibilitychange",
            handleVisibilityChange
        );

        window.addEventListener(
            "pageshow",
            handlePageShow
        );

        window.addEventListener(
            "pagehide",
            handlePageHide
        );

        window.addEventListener(
            "beforeunload",
            handleBeforeUnload
        );

        window.addEventListener(
            "storage",
            handleStorageChange
        );
    }

    // =========================================================
    // 15. Initialize
    // =========================================================

    function initialize() {
        hideMessage();

        session = loadSession();

        if (!session) {
            session = new StudySession(CONFIG.subject);
            saveSession();
        } else if (session.isPaused && session.automaticallyPaused) {
            // 이전 버전에서 자동 정지된 세션이 남아 있을 경우
            // 한 번만 자동으로 다시 시작한다.
            resumeStudy();
        }

        bindEvents();
        updateTimerUI();
        startTimer();
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            { once: true }
        );
    } else {
        initialize();
    }
})();
