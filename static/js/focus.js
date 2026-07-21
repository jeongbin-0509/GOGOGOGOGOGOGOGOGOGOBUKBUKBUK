(() => {
    "use strict";

    const pageData = window.FOCUS_PAGE_DATA || {};

    const subject = String(pageData.subject || "").trim();
    const todaySeconds = Number(pageData.todaySeconds || 0);
    const goalSeconds = Number(pageData.goalSeconds || 28800);
    const dashboardUrl = pageData.dashboardUrl || "/dashboard";
    const saveRecordUrl =
        pageData.saveRecordUrl || "/api/study-records";

    const STORAGE_KEY = "activeStudySession";

    const timerElement =
        document.getElementById("focusTimer");

    const startedAtElement =
        document.getElementById("focusStartedAt");

    const statusBadge =
        document.getElementById("focusStatusBadge");

    const pauseButton =
        document.getElementById("pauseStudyButton");

    const stopButton =
        document.getElementById("stopStudyButton");

    const todayTotalElement =
        document.getElementById("focusTodayTotal");

    const gradeElement =
        document.getElementById("focusGrade");

    const goalRateElement =
        document.getElementById("focusGoalRate");

    const goalTextElement =
        document.getElementById("focusGoalText");

    const goalProgressElement =
        document.getElementById("focusGoalProgress");

    const goalProgressBar =
        document.getElementById("focusGoalProgressBar");

    const gradeMessageElement =
        document.getElementById("focusGradeMessage");

    const messageElement =
        document.getElementById("focusMessage");

    const backLink =
        document.getElementById("focusBackLink");

    const stopConfirmModal =
        document.getElementById("stopConfirmModal");

    const stopConfirmBackdrop =
        document.getElementById("stopConfirmBackdrop");

    const cancelStopButton =
        document.getElementById("cancelStopButton");

    const confirmStopButton =
        document.getElementById("confirmStopButton");

    let timerInterval = null;
    let isSaving = false;

    function createNewSession() {
        const now = Date.now();

        return {
            subject,
            startedAt: now,
            pausedAt: null,
            totalPausedMilliseconds: 0,
            isPaused: false
        };
    }

    function loadSession() {
        try {
            const savedValue =
                localStorage.getItem(STORAGE_KEY);

            if (!savedValue) {
                return null;
            }

            const session = JSON.parse(savedValue);

            if (
                !session ||
                typeof session !== "object" ||
                !session.startedAt
            ) {
                return null;
            }

            if (session.subject !== subject) {
                return null;
            }

            return {
                subject: String(session.subject || subject),
                startedAt: Number(session.startedAt),
                pausedAt: session.pausedAt
                    ? Number(session.pausedAt)
                    : null,
                totalPausedMilliseconds: Number(
                    session.totalPausedMilliseconds || 0
                ),
                isPaused: Boolean(session.isPaused)
            };
        } catch (error) {
            console.error(
                "집중 세션 불러오기 오류:",
                error
            );

            return null;
        }
    }

    function saveSession(session) {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(session)
        );
    }

    function removeSession() {
        localStorage.removeItem(STORAGE_KEY);
    }

    let session = loadSession();

    if (!session) {
        session = createNewSession();
        saveSession(session);
    }

    function getElapsedMilliseconds() {
        const endTime = session.isPaused
            ? session.pausedAt
            : Date.now();

        const elapsed =
            endTime -
            session.startedAt -
            session.totalPausedMilliseconds;

        return Math.max(0, elapsed);
    }

    function getElapsedSeconds() {
        return Math.floor(
            getElapsedMilliseconds() / 1000
        );
    }

    function formatTime(totalSeconds) {
        const safeSeconds = Math.max(
            0,
            Math.floor(Number(totalSeconds) || 0)
        );

        const hours = Math.floor(
            safeSeconds / 3600
        );

        const minutes = Math.floor(
            (safeSeconds % 3600) / 60
        );

        const seconds = safeSeconds % 60;

        return [
            hours,
            minutes,
            seconds
        ]
            .map((value) =>
                String(value).padStart(2, "0")
            )
            .join(":");
    }

    function formatDateTime(timestamp) {
        const date = new Date(timestamp);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        return date.toLocaleString(
            "ko-KR",
            {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }
        );
    }

    function calculateGrade(totalStudySeconds) {
        if (totalStudySeconds >= 10 * 3600) {
            return {
                grade: 1,
                message:
                    "오늘 10시간 이상 공부했습니다. 1등급을 달성했습니다."
            };
        }

        if (totalStudySeconds >= 7 * 3600) {
            return {
                grade: 2,
                message:
                    "현재 2등급입니다. 1등급까지 조금만 더 집중해 보세요."
            };
        }

        if (totalStudySeconds >= 4 * 3600) {
            return {
                grade: 3,
                message:
                    "현재 3등급입니다. 꾸준히 공부시간을 늘리고 있습니다."
            };
        }

        if (totalStudySeconds >= 2 * 3600) {
            return {
                grade: 4,
                message:
                    "현재 4등급입니다. 3등급까지 계속 집중해 보세요."
            };
        }

        return {
            grade: 5,
            message:
                "2시간 이상 공부하면 다음 등급으로 올라갈 수 있습니다."
        };
    }

    function updateStatusUI() {
        if (!statusBadge || !pauseButton) {
            return;
        }

        if (session.isPaused) {
            statusBadge.textContent = "일시정지";
            statusBadge.classList.remove(
                "focus-status-running"
            );
            statusBadge.classList.add(
                "focus-status-pause"
            );

            pauseButton.textContent = "다시 시작";
        } else {
            statusBadge.textContent = "공부 중";
            statusBadge.classList.remove(
                "focus-status-pause"
            );
            statusBadge.classList.add(
                "focus-status-running"
            );

            pauseButton.textContent = "일시정지";
        }
    }

    function updateProgressUI(totalStudySeconds) {
        const safeGoalSeconds =
            goalSeconds > 0
                ? goalSeconds
                : 28800;

        const goalRate = Math.min(
            100,
            Math.round(
                totalStudySeconds /
                safeGoalSeconds *
                100
            )
        );

        if (todayTotalElement) {
            todayTotalElement.textContent =
                formatTime(totalStudySeconds);
        }

        if (goalRateElement) {
            goalRateElement.textContent =
                `${goalRate}%`;
        }

        if (goalTextElement) {
            const currentMinutes = Math.floor(
                totalStudySeconds / 60
            );

            const goalMinutes = Math.floor(
                safeGoalSeconds / 60
            );

            goalTextElement.textContent =
                `${currentMinutes} / ${goalMinutes}분`;
        }

        if (goalProgressElement) {
            goalProgressElement.style.width =
                `${goalRate}%`;
        }

        if (goalProgressBar) {
            goalProgressBar.setAttribute(
                "aria-valuenow",
                String(goalRate)
            );
        }

        const gradeInfo =
            calculateGrade(totalStudySeconds);

        if (gradeElement) {
            gradeElement.textContent =
                `${gradeInfo.grade}등급`;
        }

        if (gradeMessageElement) {
            gradeMessageElement.textContent =
                gradeInfo.message;
        }
    }

    function updateTimerUI() {
        const elapsedSeconds =
            getElapsedSeconds();

        if (timerElement) {
            timerElement.textContent =
                formatTime(elapsedSeconds);
        }

        updateProgressUI(
            todaySeconds + elapsedSeconds
        );
    }

    function startTimerInterval() {
        stopTimerInterval();

        updateTimerUI();

        timerInterval = window.setInterval(
            updateTimerUI,
            1000
        );
    }

    function stopTimerInterval() {
        if (timerInterval !== null) {
            window.clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    function pauseStudy() {
        if (session.isPaused) {
            return;
        }

        session.isPaused = true;
        session.pausedAt = Date.now();

        saveSession(session);
        updateStatusUI();
        updateTimerUI();
    }

    function resumeStudy() {
        if (!session.isPaused) {
            return;
        }

        const now = Date.now();

        if (session.pausedAt) {
            session.totalPausedMilliseconds +=
                now - session.pausedAt;
        }

        session.pausedAt = null;
        session.isPaused = false;

        saveSession(session);
        updateStatusUI();
        updateTimerUI();
    }

    function togglePause() {
        if (isSaving) {
            return;
        }

        if (session.isPaused) {
            resumeStudy();
        } else {
            pauseStudy();
        }
    }

    function showMessage(message, type = "error") {
        if (!messageElement) {
            return;
        }

        messageElement.hidden = false;
        messageElement.textContent = message;
        messageElement.dataset.type = type;
    }

    function hideMessage() {
        if (!messageElement) {
            return;
        }

        messageElement.hidden = true;
        messageElement.textContent = "";
        delete messageElement.dataset.type;
    }

    function openStopModal() {
        if (!stopConfirmModal) {
            stopStudy();
            return;
        }

        stopConfirmModal.hidden = false;

        document.body.style.overflow = "hidden";

        confirmStopButton?.focus();
    }

    function closeStopModal() {
        if (!stopConfirmModal) {
            return;
        }

        stopConfirmModal.hidden = true;

        document.body.style.overflow = "";

        stopButton?.focus();
    }

    function setSavingState(saving) {
        isSaving = saving;

        if (pauseButton) {
            pauseButton.disabled = saving;
        }

        if (stopButton) {
            stopButton.disabled = saving;
        }

        if (cancelStopButton) {
            cancelStopButton.disabled = saving;
        }

        if (confirmStopButton) {
            confirmStopButton.disabled = saving;
            confirmStopButton.textContent =
                saving
                    ? "저장 중..."
                    : "종료하고 저장";
        }
    }

    async function stopStudy() {
        if (isSaving) {
            return;
        }

        hideMessage();

        const durationSeconds =
            getElapsedSeconds();

        if (durationSeconds < 10) {
            closeStopModal();

            showMessage(
                "10초 이상 공부해야 기록을 저장할 수 있습니다."
            );

            return;
        }

        setSavingState(true);

        const startedAtIso = new Date(
            session.startedAt
        ).toISOString();

        const endedAtIso =
            new Date().toISOString();

        try {
            const response = await fetch(
                saveRecordUrl,
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json",
                        "Accept":
                            "application/json"
                    },
                    body: JSON.stringify({
                        subject,
                        duration_seconds:
                            durationSeconds,
                        started_at:
                            startedAtIso,
                        ended_at:
                            endedAtIso
                    })
                }
            );

            let result = {};

            try {
                result = await response.json();
            } catch (jsonError) {
                console.error(
                    "응답 JSON 변환 오류:",
                    jsonError
                );
            }

            if (!response.ok) {
                throw new Error(
                    result.message ||
                    "공부 기록 저장에 실패했습니다."
                );
            }

            removeSession();
            stopTimerInterval();

            window.location.replace(
                dashboardUrl
            );
        } catch (error) {
            console.error(
                "공부 기록 저장 오류:",
                error
            );

            closeStopModal();

            showMessage(
                error.message ||
                "공부 기록 저장 중 오류가 발생했습니다."
            );

            setSavingState(false);
        }
    }

    function handleBackNavigation(event) {
    if (isSaving) {
        event.preventDefault();
        return;
    }

    event.preventDefault();

    const shouldLeave = window.confirm(
        "집중모드를 나가면 현재 측정 중인 시간은 저장되지 않고 종료됩니다. 나가시겠습니까?"
    );

    if (!shouldLeave) {
        return;
    }

    stopTimerInterval();
    removeSession();

    window.location.href = dashboardUrl;
}

    function handleKeyDown(event) {
        if (
            event.key === "Escape" &&
            stopConfirmModal &&
            !stopConfirmModal.hidden &&
            !isSaving
        ) {
            closeStopModal();
        }
    }

    function initializePage() {
        if (!subject) {
            window.location.replace(
                dashboardUrl
            );

            return;
        }

        if (startedAtElement) {
            startedAtElement.textContent =
                `${formatDateTime(
                    session.startedAt
                )}부터 측정 중`;
        }

        updateStatusUI();
        updateTimerUI();
        startTimerInterval();

        pauseButton?.addEventListener(
            "click",
            togglePause
        );

        stopButton?.addEventListener(
            "click",
            openStopModal
        );

        cancelStopButton?.addEventListener(
            "click",
            closeStopModal
        );

        stopConfirmBackdrop?.addEventListener(
            "click",
            () => {
                if (!isSaving) {
                    closeStopModal();
                }
            }
        );

        confirmStopButton?.addEventListener(
            "click",
            stopStudy
        );

        backLink?.addEventListener(
            "click",
            handleBackNavigation
        );

        document.addEventListener(
            "keydown",
            handleKeyDown
        );

window.addEventListener(
    "pagehide",
    () => {
        if (isSaving) {
            return;
        }

        stopTimerInterval();
        removeSession();
    }
);

    }

    initializePage();
})();