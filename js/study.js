document.addEventListener("DOMContentLoaded", () => {
    const config =
        window.STUDY_CONFIG || {};

    const timerDisplay =
        document.getElementById(
            "timerDisplay"
        );

    const startButton =
        document.getElementById(
            "startButton"
        );

    const stopButton =
        document.getElementById(
            "stopButton"
        );

    const statusElement =
        document.getElementById(
            "studyStatus"
        );

    const noticeElement =
        document.getElementById(
            "timerNotice"
        );

    const progressValue =
        document.getElementById(
            "progressValue"
        );

    const progressFill =
        document.getElementById(
            "progressFill"
        );

    const manualRecordButton =
        document.getElementById(
            "manualRecordButton"
        );

    const goalButton =
        document.getElementById(
            "goalButton"
        );

    const mobileGoalButton =
        document.getElementById(
            "mobileGoalButton"
        );

    const modalBackdrop =
        document.getElementById(
            "modalBackdrop"
        );

    const modalTitle =
        document.getElementById(
            "modalTitle"
        );

    const modalBody =
        document.getElementById(
            "modalBody"
        );

    const modalCancel =
        document.getElementById(
            "modalCancel"
        );

    const modalConfirm =
        document.getElementById(
            "modalConfirm"
        );

    const baseSeconds = Number(
        timerDisplay?.dataset.baseSeconds
        || config.todaySeconds
        || 0
    );

    let sessionSeconds = 0;
    let timerState = "idle";

    let startedAt = null;
    let timerInterval = null;
    let previousTickTime = null;

    let modalSubmitAction = null;


    const formatTime = (seconds) => {
        const safeSeconds = Math.max(
            0,
            Math.floor(
                Number(seconds) || 0
            )
        );

        const hours = String(
            Math.floor(
                safeSeconds / 3600
            )
        ).padStart(2, "0");

        const minutes = String(
            Math.floor(
                (safeSeconds % 3600) / 60
            )
        ).padStart(2, "0");

        const secs = String(
            safeSeconds % 60
        ).padStart(2, "0");

        return `${hours}:${minutes}:${secs}`;
    };


    const readJsonResponse = async (
        response
    ) => {
        const contentType =
            response.headers.get(
                "content-type"
            ) || "";

        if (
            !contentType.includes(
                "application/json"
            )
        ) {
            const text =
                await response.text();

            console.error(
                "JSON이 아닌 서버 응답:",
                response.status,
                text
            );

            throw new Error(
                `서버 응답 오류 (${response.status})`
            );
        }

        return response.json();
    };


    const postJson = async (
        url,
        body
    ) => {
        const response = await fetch(
            url,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                credentials:
                    "same-origin",

                body: JSON.stringify(body)
            }
        );

        const result =
            await readJsonResponse(
                response
            );

        if (
            response.status === 401
            && result.redirect
        ) {
            window.location.href =
                result.redirect;

            throw new Error(
                "로그인이 필요합니다."
            );
        }

        if (
            !response.ok
            || !result.success
        ) {
            throw new Error(
                result.message
                || "요청 처리에 실패했습니다."
            );
        }

        return result;
    };


    const deleteJson = async (url) => {
        const response = await fetch(
            url,
            {
                method: "DELETE",

                credentials:
                    "same-origin"
            }
        );

        const result =
            await readJsonResponse(
                response
            );

        if (
            !response.ok
            || !result.success
        ) {
            throw new Error(
                result.message
                || "삭제에 실패했습니다."
            );
        }

        return result;
    };


    const updateTimerDisplay = () => {
        if (!timerDisplay) {
            return;
        }

        const totalSeconds =
            baseSeconds
            + sessionSeconds;

        timerDisplay.textContent =
            formatTime(totalSeconds);

        const goalSeconds = Number(
            config.goalSeconds || 28800
        );

        const progress =
            goalSeconds > 0
                ? Math.min(
                    100,
                    Math.round(
                        totalSeconds
                        / goalSeconds
                        * 100
                    )
                )
                : 0;

        if (progressValue) {
            progressValue.textContent =
                `${progress}%`;
        }

        if (progressFill) {
            progressFill.style.width =
                `${progress}%`;
        }
    };


    const updateTimerState = (
        nextState
    ) => {
        timerState = nextState;

        if (statusElement) {
            statusElement.className =
                "badge";
        }

        if (nextState === "running") {
            if (statusElement) {
                statusElement.textContent =
                    "공부중";

                statusElement.classList.add(
                    "badge-success"
                );
            }

            if (startButton) {
                startButton.disabled =
                    true;

                startButton.textContent =
                    "공부 중";
            }

            if (stopButton) {
                stopButton.disabled =
                    false;
            }

            if (noticeElement) {
                noticeElement.textContent =
                    "현재 집중 시간이 기록되고 있습니다.";
            }

            return;
        }

        if (nextState === "paused") {
            if (statusElement) {
                statusElement.textContent =
                    "일시정지";

                statusElement.classList.add(
                    "badge-warning"
                );
            }

            if (startButton) {
                startButton.disabled =
                    false;

                startButton.textContent =
                    "공부 계속하기";
            }

            if (stopButton) {
                stopButton.disabled =
                    false;
            }

            if (noticeElement) {
                noticeElement.textContent =
                    "화면을 벗어나 타이머가 일시정지되었습니다.";
            }

            return;
        }

        if (statusElement) {
            statusElement.textContent =
                "대기중";

            statusElement.classList.add(
                "badge-idle"
            );
        }

        if (startButton) {
            startButton.disabled =
                false;

            startButton.textContent =
                "공부 시작";
        }

        if (stopButton) {
            stopButton.disabled =
                true;
        }

        if (noticeElement) {
            noticeElement.textContent =
                "공부 시작 버튼을 눌러 타이머를 시작하세요.";
        }
    };


    const updateElapsedTime = () => {
        if (
            timerState !== "running"
            || previousTickTime === null
        ) {
            return;
        }

        const currentTime =
            Date.now();

        const elapsedMilliseconds =
            currentTime
            - previousTickTime;

        if (
            elapsedMilliseconds >= 1000
        ) {
            const elapsedSeconds =
                Math.floor(
                    elapsedMilliseconds
                    / 1000
                );

            sessionSeconds +=
                elapsedSeconds;

            previousTickTime +=
                elapsedSeconds * 1000;

            updateTimerDisplay();
        }
    };


    const startTimer = () => {
        if (
            timerState === "running"
        ) {
            return;
        }

        if (
            timerState === "idle"
        ) {
            sessionSeconds = 0;

            startedAt =
                new Date()
                    .toISOString();
        }

        previousTickTime =
            Date.now();

        if (
            timerInterval !== null
        ) {
            clearInterval(
                timerInterval
            );
        }

        timerInterval =
            window.setInterval(
                updateElapsedTime,
                250
            );

        updateTimerState(
            "running"
        );
    };


    const pauseTimer = () => {
        if (
            timerState !== "running"
        ) {
            return;
        }

        updateElapsedTime();

        if (
            timerInterval !== null
        ) {
            clearInterval(
                timerInterval
            );
        }

        timerInterval = null;
        previousTickTime = null;

        updateTimerState(
            "paused"
        );
    };


    const resetTimer = () => {
        if (
            timerInterval !== null
        ) {
            clearInterval(
                timerInterval
            );
        }

        timerInterval = null;
        previousTickTime = null;
        sessionSeconds = 0;
        startedAt = null;

        updateTimerState(
            "idle"
        );

        updateTimerDisplay();
    };


    const openModal = ({
        title,
        body,
        confirmText = "저장",
        onConfirm
    }) => {
        if (
            !modalBackdrop
            || !modalTitle
            || !modalBody
            || !modalConfirm
        ) {
            alert(
                "모달 HTML 요소를 찾을 수 없습니다."
            );
            return;
        }

        modalTitle.textContent =
            title;

        modalBody.innerHTML =
            body;

        modalConfirm.textContent =
            confirmText;

        modalConfirm.disabled =
            false;

        modalSubmitAction =
            onConfirm;

        modalBackdrop.classList.remove(
            "hidden"
        );

        modalBody
            .querySelector(
                "input, select, textarea"
            )
            ?.focus();
    };


    const closeModal = () => {
        if (!modalBackdrop) {
            return;
        }

        modalBackdrop.classList.add(
            "hidden"
        );

        modalSubmitAction = null;
    };


    const openTimerRecordModal =
        () => {
            if (
                timerState ===
                "running"
            ) {
                pauseTimer();
            }

            if (
                sessionSeconds < 10
            ) {
                alert(
                    "10초 이상 공부한 뒤 종료해 주세요."
                );
                return;
            }

            openModal({
                title:
                    "공부 기록 저장",

                confirmText:
                    "기록 저장",

                body: `
                    <label for="recordSubject">
                        공부한 과목
                    </label>

                    <input
                        id="recordSubject"
                        type="text"
                        maxlength="30"
                        autocomplete="off"
                        placeholder="예: 수학"
                    >

                    <p>
                        이번 공부 시간:
                        <strong>
                            ${formatTime(
                                sessionSeconds
                            )}
                        </strong>
                    </p>
                `,

                onConfirm:
                    async () => {
                        const subject =
                            document
                                .getElementById(
                                    "recordSubject"
                                )
                                ?.value
                                .trim()
                            || "";

                        if (!subject) {
                            throw new Error(
                                "공부한 과목을 입력해 주세요."
                            );
                        }

                        await postJson(
                            config.recordUrl
                            || "/api/study-records",
                            {
                                subject,
                                duration_seconds:
                                    sessionSeconds,
                                started_at:
                                    startedAt,
                                ended_at:
                                    new Date()
                                        .toISOString()
                            }
                        );

                        resetTimer();
                        closeModal();

                        window.location.reload();
                    }
            });
        };


    const openManualRecordModal =
        () => {
            const today =
                new Date()
                    .toISOString()
                    .slice(0, 10);

            openModal({
                title:
                    "공부 기록 직접 작성",

                confirmText:
                    "기록 저장",

                body: `
                    <label for="manualSubject">
                        공부한 과목
                    </label>

                    <input
                        id="manualSubject"
                        type="text"
                        maxlength="30"
                        placeholder="예: 영어"
                    >

                    <label for="manualMinutes">
                        공부 시간(분)
                    </label>

                    <input
                        id="manualMinutes"
                        type="number"
                        min="1"
                        max="960"
                        step="1"
                        placeholder="예: 90"
                    >

                    <label for="manualDate">
                        공부 날짜
                    </label>

                    <input
                        id="manualDate"
                        type="date"
                        value="${today}"
                    >
                `,

                onConfirm:
                    async () => {
                        const subject =
                            document
                                .getElementById(
                                    "manualSubject"
                                )
                                ?.value
                                .trim()
                            || "";

                        const minutes =
                            Number(
                                document
                                    .getElementById(
                                        "manualMinutes"
                                    )
                                    ?.value
                            );

                        const studyDate =
                            document
                                .getElementById(
                                    "manualDate"
                                )
                                ?.value
                            || today;

                        if (!subject) {
                            throw new Error(
                                "공부한 과목을 입력해 주세요."
                            );
                        }

                        if (
                            !Number.isInteger(
                                minutes
                            )
                            || minutes < 1
                            || minutes > 960
                        ) {
                            throw new Error(
                                "공부 시간은 1분 이상 960분 이하로 입력해 주세요."
                            );
                        }

                        await postJson(
                            config.manualRecordUrl
                            || "/api/study-records/manual",
                            {
                                subject,
                                minutes,
                                study_date:
                                    studyDate
                            }
                        );

                        closeModal();

                        window.location.reload();
                    }
            });
        };


    const openGoalModal = () => {
        const currentGoalSeconds =
            Number(
                config.goalSeconds
                || 28800
            );

        const currentGoalHours =
            currentGoalSeconds / 3600;

        openModal({
            title:
                "하루 목표시간 설정",

            confirmText:
                "목표 저장",

            body: `
                <label for="goalHours">
                    하루 목표시간
                </label>

                <input
                    id="goalHours"
                    type="number"
                    min="0.5"
                    max="16"
                    step="0.5"
                    value="${currentGoalHours}"
                >

                <p>
                    0.5시간 단위로 설정할 수 있습니다.
                </p>
            `,

            onConfirm:
                async () => {
                    const hours =
                        Number(
                            document
                                .getElementById(
                                    "goalHours"
                                )
                                ?.value
                        );

                    if (
                        !Number.isFinite(
                            hours
                        )
                        || hours < 0.5
                        || hours > 16
                    ) {
                        throw new Error(
                            "목표시간은 0.5시간 이상 16시간 이하로 입력해 주세요."
                        );
                    }

                    await postJson(
                        config.goalUrl
                        || "/api/goal",
                        {
                            hours
                        }
                    );

                    closeModal();

                    window.location.reload();
                }
        });
    };


    startButton?.addEventListener(
        "click",
        startTimer
    );

    stopButton?.addEventListener(
        "click",
        openTimerRecordModal
    );

    manualRecordButton?.addEventListener(
        "click",
        openManualRecordModal
    );

    goalButton?.addEventListener(
        "click",
        openGoalModal
    );

    mobileGoalButton?.addEventListener(
        "click",
        openGoalModal
    );


    document.addEventListener(
        "visibilitychange",
        () => {
            if (
                document.hidden
            ) {
                pauseTimer();
            }
        }
    );


    window.addEventListener(
        "blur",
        () => {
            if (
                timerState
                === "running"
            ) {
                pauseTimer();
            }
        }
    );


    modalCancel?.addEventListener(
        "click",
        closeModal
    );


    modalBackdrop?.addEventListener(
        "click",
        (event) => {
            if (
                event.target
                === modalBackdrop
            ) {
                closeModal();
            }
        }
    );


    modalConfirm?.addEventListener(
        "click",
        async () => {
            if (
                !modalSubmitAction
            ) {
                return;
            }

            const originalText =
                modalConfirm.textContent;

            modalConfirm.disabled =
                true;

            modalConfirm.textContent =
                "처리 중...";

            try {
                await modalSubmitAction();

            } catch (error) {
                console.error(
                    "처리 오류:",
                    error
                );

                alert(
                    error.message
                    || "처리 중 오류가 발생했습니다."
                );

            } finally {
                modalConfirm.disabled =
                    false;

                modalConfirm.textContent =
                    originalText;
            }
        }
    );


    document
        .querySelectorAll(
            "[data-delete-record]"
        )
        .forEach((button) => {
            button.addEventListener(
                "click",
                async () => {
                    const recordId =
                        button.dataset
                            .deleteRecord;

                    if (!recordId) {
                        return;
                    }

                    const confirmed =
                        window.confirm(
                            "이 공부 기록을 삭제할까요?"
                        );

                    if (!confirmed) {
                        return;
                    }

                    button.disabled =
                        true;

                    try {
                        await deleteJson(
                            `/api/study-records/${recordId}`
                        );

                        window.location.reload();

                    } catch (error) {
                        alert(
                            error.message
                            || "삭제 중 오류가 발생했습니다."
                        );

                        button.disabled =
                            false;
                    }
                }
            );
        });


    window.addEventListener(
        "beforeunload",
        (event) => {
            if (
                timerState === "running"
                || timerState === "paused"
            ) {
                event.preventDefault();

                event.returnValue = "";
            }
        }
    );


    updateTimerDisplay();

    updateTimerState(
        "idle"
    );
});