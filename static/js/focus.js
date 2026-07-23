(() => {
    "use strict";

    // =========================================================
    // 페이지 설정
    // =========================================================

    const pageData =
        window.FOCUS_PAGE_DATA || {};

    const subject = String(
        pageData.subject || ""
    ).trim();

    const todaySeconds = Number(
        pageData.todaySeconds || 0
    );

    const goalSeconds = Number(
        pageData.goalSeconds || 28800
    );

    const dashboardUrl =
        pageData.dashboardUrl ||
        "/dashboard";

    const saveRecordUrl =
        pageData.saveRecordUrl ||
        "/api/study-records";

    const STORAGE_KEY =
        "activeStudySession";

    // =========================================================
    // DOM
    // =========================================================

    const timerElement =
        document.getElementById(
            "focusTimer"
        );

    const startedAtElement =
        document.getElementById(
            "focusStartedAt"
        );

    const statusBadge =
        document.getElementById(
            "focusStatusBadge"
        );

    const pauseButton =
        document.getElementById(
            "pauseStudyButton"
        );

    const stopButton =
        document.getElementById(
            "stopStudyButton"
        );

    const todayTotalElement =
        document.getElementById(
            "focusTodayTotal"
        );

    const gradeElement =
        document.getElementById(
            "focusGrade"
        );

    const goalRateElement =
        document.getElementById(
            "focusGoalRate"
        );

    const goalTextElement =
        document.getElementById(
            "focusGoalText"
        );

    const goalProgressElement =
        document.getElementById(
            "focusGoalProgress"
        );

    const goalProgressBar =
        document.getElementById(
            "focusGoalProgressBar"
        );

    const gradeMessageElement =
        document.getElementById(
            "focusGradeMessage"
        );

    const messageElement =
        document.getElementById(
            "focusMessage"
        );

    const backLink =
        document.getElementById(
            "focusBackLink"
        );

    const stopConfirmModal =
        document.getElementById(
            "stopConfirmModal"
        );

    const stopConfirmBackdrop =
        document.getElementById(
            "stopConfirmBackdrop"
        );

    const cancelStopButton =
        document.getElementById(
            "cancelStopButton"
        );

    const confirmStopButton =
        document.getElementById(
            "confirmStopButton"
        );

    // =========================================================
    // 상태
    // =========================================================

    let timerInterval = null;
    let isSaving = false;

    /*
     * 페이지 이동 처리를 중복 실행하지 않기 위한 값이다.
     *
     * visibilitychange와 pagehide가 연속해서 발생해도
     * 같은 일시정지 처리를 반복하지 않도록 한다.
     */
    let isHandlingVisibility = false;

    // =========================================================
    // 세션 생성 및 저장
    // =========================================================

    function createNewSession() {
        const now = Date.now();

        return {
            subject,
            startedAt: now,

            /*
             * 현재 일시정지가 시작된 시각
             */
            pausedAt: null,

            /*
             * 지금까지 누적된 전체 일시정지 시간
             */
            totalPausedMilliseconds: 0,

            /*
             * 현재 일시정지 상태인지
             */
            isPaused: false,

            /*
             * 사용자가 버튼을 눌러 멈춘 것이 아니라,
             * 다른 앱·탭·화면으로 이동해서 자동으로
             * 멈춘 것인지 구분한다.
             */
            automaticallyPaused: false
        };
    }

    function loadSession() {
        try {
            const savedValue =
                localStorage.getItem(
                    STORAGE_KEY
                );

            if (!savedValue) {
                return null;
            }

            const savedSession =
                JSON.parse(savedValue);

            if (
                !savedSession ||
                typeof savedSession !==
                    "object" ||
                !savedSession.startedAt
            ) {
                return null;
            }

            if (
                String(
                    savedSession.subject ||
                    ""
                ) !== subject
            ) {
                return null;
            }

            return {
                subject: String(
                    savedSession.subject ||
                    subject
                ),

                startedAt: Number(
                    savedSession.startedAt
                ),

                pausedAt:
                    savedSession.pausedAt !==
                    null &&
                    savedSession.pausedAt !==
                    undefined
                        ? Number(
                              savedSession.pausedAt
                          )
                        : null,

                totalPausedMilliseconds:
                    Math.max(
                        0,
                        Number(
                            savedSession
                                .totalPausedMilliseconds ||
                            0
                        )
                    ),

                isPaused: Boolean(
                    savedSession.isPaused
                ),

                automaticallyPaused:
                    Boolean(
                        savedSession
                            .automaticallyPaused
                    )
            };
        } catch (error) {
            console.error(
                "집중 세션 불러오기 오류:",
                error
            );

            return null;
        }
    }

    function saveSession() {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(session)
            );
        } catch (error) {
            console.error(
                "집중 세션 저장 오류:",
                error
            );
        }
    }

    function removeSession() {
        try {
            localStorage.removeItem(
                STORAGE_KEY
            );
        } catch (error) {
            console.error(
                "집중 세션 삭제 오류:",
                error
            );
        }
    }

    let session = loadSession();

    if (!session) {
        session = createNewSession();
        saveSession();
    }

    // =========================================================
    // 시간 계산
    // =========================================================

    function getElapsedMilliseconds() {
        const endTime =
            session.isPaused &&
            session.pausedAt
                ? session.pausedAt
                : Date.now();

        const elapsed =
            endTime -
            session.startedAt -
            session.totalPausedMilliseconds;

        return Math.max(
            0,
            elapsed
        );
    }

    function getElapsedSeconds() {
        return Math.floor(
            getElapsedMilliseconds() /
            1000
        );
    }

    function formatTime(
        totalSeconds
    ) {
        const safeSeconds = Math.max(
            0,
            Math.floor(
                Number(totalSeconds) || 0
            )
        );

        const hours = Math.floor(
            safeSeconds / 3600
        );

        const minutes = Math.floor(
            (
                safeSeconds %
                3600
            ) / 60
        );

        const seconds =
            safeSeconds % 60;

        return [
            hours,
            minutes,
            seconds
        ]
            .map((value) =>
                String(value).padStart(
                    2,
                    "0"
                )
            )
            .join(":");
    }

    function formatDateTime(
        timestamp
    ) {
        const date = new Date(
            timestamp
        );

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
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

    // =========================================================
    // 공부 등급
    // =========================================================

    function calculateGrade(
        totalStudySeconds
    ) {
        if (
            totalStudySeconds >=
            12 * 3600
        ) {
            return {
                grade: 1,
                message:
                    "오늘 12시간 이상 공부했습니다. 1등급을 달성했습니다."
            };
        }

        if (
            totalStudySeconds >=
            8 * 3600
        ) {
            return {
                grade: 2,
                message:
                    "현재 2등급입니다. 1등급까지 조금만 더 집중해 보세요."
            };
        }

        if (
            totalStudySeconds >=
            5 * 3600
        ) {
            return {
                grade: 3,
                message:
                    "현재 3등급입니다. 꾸준히 공부시간을 늘리고 있습니다."
            };
        }

        if (
            totalStudySeconds >=
            3 * 3600
        ) {
            return {
                grade: 4,
                message:
                    "현재 4등급입니다. 3등급까지 계속 집중해 보세요."
            };
        }

        return {
            grade: 5,
            message:
                "3시간 이상 공부하면 다음 등급으로 올라갈 수 있습니다."
        };
    }

    // =========================================================
    // UI 갱신
    // =========================================================

    function updateStatusUI() {
        if (
            !statusBadge ||
            !pauseButton
        ) {
            return;
        }

        if (session.isPaused) {
            if (
                session.automaticallyPaused
            ) {
                statusBadge.textContent =
                    "화면 이탈로 일시정지";
            } else {
                statusBadge.textContent =
                    "일시정지";
            }

            statusBadge.classList.remove(
                "focus-status-running"
            );

            statusBadge.classList.add(
                "focus-status-pause"
            );

            pauseButton.textContent =
                "다시 시작";
        } else {
            statusBadge.textContent =
                "공부 중";

            statusBadge.classList.remove(
                "focus-status-pause"
            );

            statusBadge.classList.add(
                "focus-status-running"
            );

            pauseButton.textContent =
                "일시정지";
        }
    }

    function updateProgressUI(
        totalStudySeconds
    ) {
        const safeGoalSeconds =
            goalSeconds > 0
                ? goalSeconds
                : 28800;

        const goalRate = Math.min(
            100,
            Math.round(
                (
                    totalStudySeconds /
                    safeGoalSeconds
                ) * 100
            )
        );

        if (todayTotalElement) {
            todayTotalElement.textContent =
                formatTime(
                    totalStudySeconds
                );
        }

        if (goalRateElement) {
            goalRateElement.textContent =
                `${goalRate}%`;
        }

        if (goalTextElement) {
            const currentMinutes =
                Math.floor(
                    totalStudySeconds /
                    60
                );

            const goalMinutes =
                Math.floor(
                    safeGoalSeconds /
                    60
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
            calculateGrade(
                totalStudySeconds
            );

        if (gradeElement) {
            gradeElement.textContent =
                `${gradeInfo.grade}등급`;
        }

        if (
            gradeMessageElement
        ) {
            gradeMessageElement.textContent =
                gradeInfo.message;
        }
    }

    function updateTimerUI() {
        const elapsedSeconds =
            getElapsedSeconds();

        if (timerElement) {
            timerElement.textContent =
                formatTime(
                    elapsedSeconds
                );
        }

        updateProgressUI(
            todaySeconds +
            elapsedSeconds
        );
    }

    // =========================================================
    // 타이머 반복 실행
    // =========================================================

    function startTimerInterval() {
        stopTimerInterval();
        updateTimerUI();

        /*
         * 일시정지 중에는 초 단위 반복 실행이 필요 없다.
         */
        if (session.isPaused) {
            return;
        }

        timerInterval =
            window.setInterval(
                updateTimerUI,
                1000
            );
    }

    function stopTimerInterval() {
        if (
            timerInterval !== null
        ) {
            window.clearInterval(
                timerInterval
            );

            timerInterval = null;
        }
    }

    // =========================================================
    // 일시정지 및 재개
    // =========================================================

    function pauseStudy({
        automatic = false
    } = {}) {
        if (
            isSaving ||
            session.isPaused
        ) {
            return;
        }

        session.isPaused = true;
        session.pausedAt =
            Date.now();

        session.automaticallyPaused =
            automatic;

        saveSession();
        stopTimerInterval();
        updateStatusUI();
        updateTimerUI();
    }

    function resumeStudy({
        automatic = false
    } = {}) {
        if (
            isSaving ||
            !session.isPaused
        ) {
            return;
        }

        /*
         * 자동 복귀인 경우에는 자동으로 멈춘 세션만
         * 다시 시작한다.
         *
         * 사용자가 직접 일시정지 버튼을 눌렀다면
         * 화면으로 돌아와도 계속 멈춘 상태를 유지한다.
         */
        if (
            automatic &&
            !session.automaticallyPaused
        ) {
            return;
        }

        const now = Date.now();

        if (session.pausedAt) {
            session
                .totalPausedMilliseconds +=
                Math.max(
                    0,
                    now -
                    session.pausedAt
                );
        }

        session.pausedAt = null;
        session.isPaused = false;
        session.automaticallyPaused =
            false;

        saveSession();
        updateStatusUI();
        updateTimerUI();
        startTimerInterval();
    }

    function togglePause() {
        if (isSaving) {
            return;
        }

        if (session.isPaused) {
            /*
             * 사용자가 직접 다시 시작한 것이므로
             * automatic을 사용하지 않는다.
             */
            resumeStudy({
                automatic: false
            });
        } else {
            /*
             * 사용자가 직접 멈춘 경우
             */
            pauseStudy({
                automatic: false
            });
        }
    }

    // =========================================================
    // 화면 이탈 자동 일시정지
    // =========================================================

    function pauseForVisibilityChange() {
        if (
            isSaving ||
            session.isPaused
        ) {
            return;
        }

        pauseStudy({
            automatic: true
        });
    }

    function resumeForVisibilityChange() {
        if (
            isSaving ||
            !session.isPaused ||
            !session.automaticallyPaused
        ) {
            return;
        }

        resumeStudy({
            automatic: true
        });
    }

    function handleVisibilityChange() {
        if (isHandlingVisibility) {
            return;
        }

        isHandlingVisibility = true;

        try {
            if (
                document.visibilityState ===
                "hidden"
            ) {
                pauseForVisibilityChange();
            } else if (
                document.visibilityState ===
                "visible"
            ) {
                resumeForVisibilityChange();
            }
        } finally {
            window.setTimeout(
                () => {
                    isHandlingVisibility =
                        false;
                },
                50
            );
        }
    }

    function handlePageHide() {
        if (isSaving) {
            return;
        }

        /*
         * 중요:
         * 여기서 removeSession()을 호출하면 안 된다.
         *
         * 모바일에서 다른 앱으로 이동하거나
         * 브라우저를 백그라운드로 보내도
         * pagehide가 발생할 수 있다.
         */
        pauseForVisibilityChange();
        stopTimerInterval();
        saveSession();
    }

    function handlePageShow() {
        if (isSaving) {
            return;
        }

        /*
         * pageshow 시점에는 visibilityState가 아직
         * hidden으로 표시되는 브라우저가 있을 수 있다.
         */
        window.setTimeout(
            () => {
                if (
                    document.visibilityState ===
                    "visible"
                ) {
                    resumeForVisibilityChange();
                }

                updateStatusUI();
                updateTimerUI();

                if (!session.isPaused) {
                    startTimerInterval();
                }
            },
            50
        );
    }

    /*
     * 대시보드처럼 집중 페이지 자체를 벗어나는 경우에는
     * 자동 복귀가 아니라 일시정지 상태로 남도록 한다.
     */
    function pauseSessionBeforeLeave() {
        if (
            isSaving ||
            session.isPaused
        ) {
            return;
        }

        pauseStudy({
            automatic: false
        });
    }

    // =========================================================
    // 메시지
    // =========================================================

    function showMessage(
        message,
        type = "error"
    ) {
        if (!messageElement) {
            return;
        }

        messageElement.hidden =
            false;

        messageElement.textContent =
            message;

        messageElement.dataset.type =
            type;
    }

    function hideMessage() {
        if (!messageElement) {
            return;
        }

        messageElement.hidden =
            true;

        messageElement.textContent =
            "";

        delete messageElement
            .dataset.type;
    }

    // =========================================================
    // 종료 확인 모달
    // =========================================================

    function openStopModal() {
        if (!stopConfirmModal) {
            stopStudy();
            return;
        }

        stopConfirmModal.hidden =
            false;

        document.body.style.overflow =
            "hidden";

        confirmStopButton?.focus();
    }

    function closeStopModal() {
        if (!stopConfirmModal) {
            return;
        }

        stopConfirmModal.hidden =
            true;

        document.body.style.overflow =
            "";

        stopButton?.focus();
    }

    function setSavingState(
        saving
    ) {
        isSaving = saving;

        if (pauseButton) {
            pauseButton.disabled =
                saving;
        }

        if (stopButton) {
            stopButton.disabled =
                saving;
        }

        if (cancelStopButton) {
            cancelStopButton.disabled =
                saving;
        }

        if (confirmStopButton) {
            confirmStopButton.disabled =
                saving;

            confirmStopButton.textContent =
                saving
                    ? "저장 중..."
                    : "종료하고 저장";
        }
    }

    // =========================================================
    // 공부 종료 및 기록 저장
    // =========================================================

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
        stopTimerInterval();

        const startedAtIso =
            new Date(
                session.startedAt
            ).toISOString();

        const endedAtTimestamp =
            session.isPaused &&
            session.pausedAt
                ? session.pausedAt
                : Date.now();

        const endedAtIso =
            new Date(
                endedAtTimestamp
            ).toISOString();

        try {
            const response =
                await fetch(
                    saveRecordUrl,
                    {
                        method: "POST",

                        credentials:
                            "same-origin",

                        headers: {
                            "Content-Type":
                                "application/json",

                            Accept:
                                "application/json"
                        },

                        body:
                            JSON.stringify({
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
                result =
                    await response.json();
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

            /*
             * 사용자가 종료 버튼을 눌러 정상 저장한 경우에만
             * 진행 중인 세션을 삭제한다.
             */
            removeSession();

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

            /*
             * 저장에 실패했을 때 기존 상태에 맞게
             * 타이머를 다시 실행한다.
             */
            if (!session.isPaused) {
                startTimerInterval();
            }
        }
    }

    // =========================================================
    // 대시보드로 이동
    // =========================================================

    function handleBackNavigation(
        event
    ) {
        if (isSaving) {
            event.preventDefault();
            return;
        }

        event.preventDefault();

        const shouldLeave =
            window.confirm(
                "집중모드를 나가면 타이머가 일시정지됩니다. 대시보드로 이동할까요?"
            );

        if (!shouldLeave) {
            return;
        }

        pauseSessionBeforeLeave();

        window.location.href =
            dashboardUrl;
    }

    // =========================================================
    // 키보드
    // =========================================================

    function handleKeyDown(
        event
    ) {
        if (
            event.key ===
                "Escape" &&
            stopConfirmModal &&
            !stopConfirmModal.hidden &&
            !isSaving
        ) {
            closeStopModal();
        }
    }

    // =========================================================
    // 초기화
    // =========================================================

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

        /*
         * 이전에 화면 이탈로 자동 정지된 세션이 있고
         * 현재 페이지가 보이는 상태라면 자동 재개한다.
         */
        if (
            document.visibilityState ===
                "visible" &&
            session.isPaused &&
            session.automaticallyPaused
        ) {
            resumeForVisibilityChange();
        } else {
            updateStatusUI();
            updateTimerUI();

            if (!session.isPaused) {
                startTimerInterval();
            }
        }

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

        stopConfirmBackdrop
            ?.addEventListener(
                "click",
                () => {
                    if (!isSaving) {
                        closeStopModal();
                    }
                }
            );

        confirmStopButton
            ?.addEventListener(
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

        /*
         * 탭 이동, 다른 앱 실행, 화면 잠금 등에 대응한다.
         */
        document.addEventListener(
            "visibilitychange",
            handleVisibilityChange
        );

        /*
         * 모바일 Safari와 bfcache 상황을 보완한다.
         */
        window.addEventListener(
            "pagehide",
            handlePageHide
        );

        window.addEventListener(
            "pageshow",
            handlePageShow
        );

        /*
         * 브라우저가 다시 포커스를 얻는 경우 보조적으로 처리한다.
         */
        window.addEventListener(
            "focus",
            () => {
                if (
                    document.visibilityState ===
                    "visible"
                ) {
                    resumeForVisibilityChange();
                }
            }
        );

        window.addEventListener(
            "blur",
            () => {
                /*
                 * 단순히 주소창을 누른 경우에도 blur가 발생할 수 있어서
                 * visibilityState가 hidden일 때만 자동 정지한다.
                 */
                if (
                    document.visibilityState ===
                    "hidden"
                ) {
                    pauseForVisibilityChange();
                }
            }
        );
    }

    initializePage();
})();