    (() => {
      "use strict";

      // =========================================================
      // 기본 설정
      // =========================================================

      const pageData =
        window.FOCUS_PAGE_DATA || {};

      const subject = String(
        pageData.subject || "",
      ).trim();

      const todaySeconds = Math.max(
        0,
        Number(pageData.todaySeconds) || 0,
      );

      const goalSeconds = Math.max(
        1,
        Number(pageData.goalSeconds) || 28800,
      );

      const dashboardUrl = String(
        pageData.dashboardUrl || "/dashboard",
      );

      const saveRecordUrl = String(
        pageData.saveRecordUrl ||
          "/api/study-records",
      );

      const STORAGE_KEY =
        "activeStudySession";

      const MINIMUM_SAVE_SECONDS = 10;

      // =========================================================
      // DOM
      // =========================================================

      const timerElement =
        document.getElementById("focusTimer");

      const startedAtElement =
        document.getElementById(
          "focusStartedAt",
        );

      const statusBadge =
        document.getElementById(
          "focusStatusBadge",
        );

      const pauseButton =
        document.getElementById(
          "pauseStudyButton",
        );

      const stopButton =
        document.getElementById(
          "stopStudyButton",
        );

      const todayTotalElement =
        document.getElementById(
          "focusTodayTotal",
        );

      const gradeElement =
        document.getElementById(
          "focusGrade",
        );

      const goalRateElement =
        document.getElementById(
          "focusGoalRate",
        );

      const goalTextElement =
        document.getElementById(
          "focusGoalText",
        );

      const goalProgressElement =
        document.getElementById(
          "focusGoalProgress",
        );

      const goalProgressBar =
        document.getElementById(
          "focusGoalProgressBar",
        );

      const gradeMessageElement =
        document.getElementById(
          "focusGradeMessage",
        );

      const messageElement =
        document.getElementById(
          "focusMessage",
        );

      const backLink =
        document.getElementById(
          "focusBackLink",
        );

      const stopConfirmModal =
        document.getElementById(
          "stopConfirmModal",
        );

      const stopConfirmBackdrop =
        document.getElementById(
          "stopConfirmBackdrop",
        );

      const cancelStopButton =
        document.getElementById(
          "cancelStopButton",
        );

      const confirmStopButton =
        document.getElementById(
          "confirmStopButton",
        );

      // =========================================================
      // 상태
      // =========================================================

      let session = null;
      let timerInterval = null;
      let isSaving = false;

      // =========================================================
      // 공통 함수
      // =========================================================

      function toSafeNumber(
        value,
        defaultValue = 0,
      ) {
        const number = Number(value);

        if (!Number.isFinite(number)) {
          return defaultValue;
        }

        return number;
      }

      function formatTime(totalSeconds) {
        const safeSeconds = Math.max(
          0,
          Math.floor(
            toSafeNumber(totalSeconds),
          ),
        );

        const hours = String(
          Math.floor(safeSeconds / 3600),
        ).padStart(2, "0");

        const minutes = String(
          Math.floor(
            (safeSeconds % 3600) / 60,
          ),
        ).padStart(2, "0");

        const seconds = String(
          safeSeconds % 60,
        ).padStart(2, "0");

        return `${hours}:${minutes}:${seconds}`;
      }

      function formatDateTime(value) {
        const date = new Date(value);

        if (
          Number.isNaN(date.getTime())
        ) {
          return "-";
        }

        return date.toLocaleString("ko-KR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
      }

      // =========================================================
      // 로컬 집중 세션
      // =========================================================

      function createNewSession() {
        return {
          subject,
          startedAt: Date.now(),

          // 일시정지를 시작한 시각
          pausedAt: null,

          // 지금까지 끝난 일시정지 시간의 합
          totalPausedMilliseconds: 0,

          // 현재 일시정지 상태
          isPaused: false,

          // 탭 이동 등으로 자동 정지되었는지
          automaticallyPaused: false,
        };
      }

      function normalizeSession(
        savedSession,
      ) {
        if (
          !savedSession ||
          typeof savedSession !== "object"
        ) {
          return null;
        }

        const savedSubject = String(
          savedSession.subject || "",
        ).trim();

        const startedAt = toSafeNumber(
          savedSession.startedAt,
          0,
        );

        if (
          !savedSubject ||
          !startedAt
        ) {
          return null;
        }

        if (savedSubject !== subject) {
          return null;
        }

        const isPaused = Boolean(
          savedSession.isPaused,
        );

        let pausedAt = null;

        if (
          savedSession.pausedAt !== null &&
          savedSession.pausedAt !== undefined
        ) {
          pausedAt = toSafeNumber(
            savedSession.pausedAt,
            null,
          );
        }

        /*
         * 손상된 저장값에서 isPaused만 true이고 pausedAt이
         * 없는 경우 현재 시각을 일시정지 시점으로 사용한다.
         */
        if (
          isPaused &&
          !pausedAt
        ) {
          pausedAt = Date.now();
        }

        return {
          subject: savedSubject,
          startedAt,
          pausedAt,

          totalPausedMilliseconds:
            Math.max(
              0,
              toSafeNumber(
                savedSession
                  .totalPausedMilliseconds,
                0,
              ),
            ),

          isPaused,

          automaticallyPaused:
            Boolean(
              savedSession
                .automaticallyPaused,
            ),
        };
      }

      function loadSession() {
        try {
          const savedValue =
            localStorage.getItem(
              STORAGE_KEY,
            );

          if (!savedValue) {
            return null;
          }

          const savedSession =
            JSON.parse(savedValue);

          const normalizedSession =
            normalizeSession(savedSession);

          /*
           * 현재 과목과 다른 세션은 삭제하지 않는다.
           * 대시보드에서 기존 과목 집중모드로 돌아갈 수 있어야 한다.
           */
          return normalizedSession;
        } catch (error) {
          console.error(
            "집중 세션 불러오기 오류:",
            error,
          );

          return null;
        }
      }

      function saveSession() {
        if (!session) {
          return;
        }

        try {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(session),
          );
        } catch (error) {
          console.error(
            "집중 세션 저장 오류:",
            error,
          );
        }
      }

      function removeSession() {
        try {
          localStorage.removeItem(
            STORAGE_KEY,
          );
        } catch (error) {
          console.error(
            "집중 세션 삭제 오류:",
            error,
          );
        }
      }

      // =========================================================
      // 측정 시간
      // =========================================================

      function getElapsedMilliseconds() {
        if (!session) {
          return 0;
        }

        const measurementEnd =
          session.isPaused &&
          session.pausedAt
            ? session.pausedAt
            : Date.now();

        const elapsedMilliseconds =
          measurementEnd -
          session.startedAt -
          session.totalPausedMilliseconds;

        return Math.max(
          0,
          elapsedMilliseconds,
        );
      }

      function getElapsedSeconds() {
        return Math.floor(
          getElapsedMilliseconds() / 1000,
        );
      }

      // =========================================================
      // 공부 등급
      // =========================================================

      function calculateGrade(
        totalStudySeconds,
      ) {
        if (
          totalStudySeconds >=
          12 * 3600
        ) {
          return {
            grade: 1,
            message:
              "오늘 12시간 이상 공부했습니다. 1등급을 달성했습니다.",
          };
        }

        if (
          totalStudySeconds >=
          8 * 3600
        ) {
          return {
            grade: 2,
            message:
              "현재 2등급입니다. 1등급까지 조금만 더 집중해 보세요.",
          };
        }

        if (
          totalStudySeconds >=
          5 * 3600
        ) {
          return {
            grade: 3,
            message:
              "현재 3등급입니다. 꾸준히 공부시간을 늘리고 있습니다.",
          };
        }

        if (
          totalStudySeconds >=
          3 * 3600
        ) {
          return {
            grade: 4,
            message:
              "현재 4등급입니다. 3등급까지 계속 집중해 보세요.",
          };
        }

        return {
          grade: 5,
          message:
            "3시간 이상 공부하면 다음 등급으로 올라갈 수 있습니다.",
        };
      }

      // =========================================================
      // 메시지
      // =========================================================

      function showMessage(
        message,
        type = "error",
      ) {
        if (!messageElement) {
          return;
        }

        messageElement.textContent =
          String(message || "");

        messageElement.dataset.type =
          type;

        messageElement.hidden = false;
      }

      function hideMessage() {
        if (!messageElement) {
          return;
        }

        messageElement.textContent = "";
        messageElement.hidden = true;

        delete messageElement.dataset.type;
      }

      // =========================================================
      // UI 갱신
      // =========================================================

      function updateStatusUI() {
        if (
          !statusBadge ||
          !pauseButton ||
          !session
        ) {
          return;
        }

        statusBadge.classList.remove(
          "focus-status-running",
          "focus-status-pause",
        );

        if (session.isPaused) {
          statusBadge.classList.add(
            "focus-status-pause",
          );

          if (
            session.automaticallyPaused
          ) {
            statusBadge.textContent =
              "화면 이탈로 일시정지";
          } else {
            statusBadge.textContent =
              "일시정지";
          }

          pauseButton.textContent =
            "다시 시작";

          return;
        }

        statusBadge.classList.add(
          "focus-status-running",
        );

        statusBadge.textContent =
          "공부 중";

        pauseButton.textContent =
          "일시정지";
      }

      function updateProgressUI(
        totalStudySeconds,
      ) {
        const safeTotalSeconds =
          Math.max(
            0,
            Math.floor(
              toSafeNumber(
                totalStudySeconds,
              ),
            ),
          );

        const goalRate = Math.min(
          100,
          Math.round(
            (
              safeTotalSeconds /
              goalSeconds
            ) * 100,
          ),
        );

        const currentMinutes =
          Math.floor(
            safeTotalSeconds / 60,
          );

        const goalMinutes =
          Math.floor(
            goalSeconds / 60,
          );

        if (todayTotalElement) {
          todayTotalElement.textContent =
            formatTime(
              safeTotalSeconds,
            );
        }

        if (goalRateElement) {
          goalRateElement.textContent =
            `${goalRate}%`;
        }

        if (goalTextElement) {
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
            String(goalRate),
          );
        }

        const gradeInfo =
          calculateGrade(
            safeTotalSeconds,
          );

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
        if (!session) {
          return;
        }

        const elapsedSeconds =
          getElapsedSeconds();

        if (timerElement) {
          timerElement.textContent =
            formatTime(elapsedSeconds);
        }

        updateProgressUI(
          todaySeconds +
            elapsedSeconds,
        );
      }

      // =========================================================
      // 타이머 반복 실행
      // =========================================================

      function stopTimerInterval() {
        if (timerInterval === null) {
          return;
        }

        window.clearInterval(
          timerInterval,
        );

        timerInterval = null;
      }

      function startTimerInterval() {
        stopTimerInterval();
        updateTimerUI();

        if (
          !session ||
          session.isPaused ||
          isSaving
        ) {
          return;
        }

        timerInterval =
          window.setInterval(
            updateTimerUI,
            1000,
          );
      }

      // =========================================================
      // 일시정지 및 재개
      // =========================================================

      function pauseStudy({
        automatic = false,
      } = {}) {
        if (
          isSaving ||
          !session ||
          session.isPaused
        ) {
          return;
        }

        session.isPaused = true;
        session.pausedAt = Date.now();

        session.automaticallyPaused =
          Boolean(automatic);

        saveSession();
        stopTimerInterval();

        updateStatusUI();
        updateTimerUI();
      }

      function resumeStudy({
        automatic = false,
      } = {}) {
        if (
          isSaving ||
          !session ||
          !session.isPaused
        ) {
          return;
        }

        /*
         * 자동 복귀는 자동으로 정지된 세션에만 적용한다.
         * 사용자가 직접 일시정지한 세션은 자동으로 재개하지 않는다.
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
                session.pausedAt,
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
        if (
          isSaving ||
          !session
        ) {
          return;
        }

        hideMessage();

        if (session.isPaused) {
          resumeStudy({
            automatic: false,
          });
        } else {
          pauseStudy({
            automatic: false,
          });
        }
      }

      // =========================================================
      // 백그라운드 및 화면 잠금 처리
      // =========================================================

      function handleVisibilityChange() {
        if (
          !session ||
          isSaving
        ) {
          return;
        }

        if (
          document.visibilityState ===
          "hidden"
        ) {
          /*
           * 백그라운드에서는 화면 표시용 반복만 멈춘다.
           * 공부시간은 startedAt과 현재 시각의 차이로 계산되므로
           * 세션 자체는 계속 진행된다.
           */
          stopTimerInterval();
          saveSession();
          return;
        }

        updateStatusUI();
        updateTimerUI();

        if (!session.isPaused) {
          startTimerInterval();
        }
      }

      function handlePageHide() {
        if (
          !session ||
          isSaving
        ) {
          return;
        }

        /*
         * 화면 잠금, 다른 앱 이동, 새로고침 시에도
         * 공부 세션은 일시정지하지 않는다.
         */
        stopTimerInterval();
        saveSession();
      }

      function handlePageShow() {
        if (
          !session ||
          isSaving
        ) {
          return;
        }

        updateStatusUI();
        updateTimerUI();

        if (!session.isPaused) {
          startTimerInterval();
        }
      }

      function handleWindowFocus() {
        if (
          !session ||
          isSaving
        ) {
          return;
        }

        updateStatusUI();
        updateTimerUI();

        if (!session.isPaused) {
          startTimerInterval();
        }
      }

      // =========================================================
      // 종료 모달
      // =========================================================

      function openStopModal() {
        if (isSaving) {
          return;
        }

        hideMessage();

        if (!stopConfirmModal) {
          stopStudy();
          return;
        }

        stopConfirmModal.hidden =
          false;

        document.body.style.overflow =
          "hidden";

        window.setTimeout(() => {
          confirmStopButton?.focus();
        }, 0);
      }

      function closeStopModal() {
        if (
          !stopConfirmModal ||
          isSaving
        ) {
          return;
        }

        stopConfirmModal.hidden =
          true;

        document.body.style.overflow =
          "";

        stopButton?.focus();
      }

      function setSavingState(saving) {
        isSaving = Boolean(saving);

        if (pauseButton) {
          pauseButton.disabled =
            isSaving;
        }

        if (stopButton) {
          stopButton.disabled =
            isSaving;
        }

        if (cancelStopButton) {
          cancelStopButton.disabled =
            isSaving;
        }

        if (confirmStopButton) {
          confirmStopButton.disabled =
            isSaving;

          confirmStopButton.textContent =
            isSaving
              ? "저장 중..."
              : "종료하고 저장";
        }
      }

      // =========================================================
      // 공부 종료 및 DB 저장
      // =========================================================

      async function stopStudy() {
        if (
          isSaving ||
          !session
        ) {
          return;
        }

        hideMessage();

        const durationSeconds =
          getElapsedSeconds();

        if (
          durationSeconds <
          MINIMUM_SAVE_SECONDS
        ) {
          closeStopModal();

          showMessage(
            `${MINIMUM_SAVE_SECONDS}초 이상 공부해야 기록을 저장할 수 있습니다.`,
          );

          return;
        }

        setSavingState(true);
        stopTimerInterval();

        const endedAtTimestamp =
          session.isPaused &&
          session.pausedAt
            ? session.pausedAt
            : Date.now();

        const requestBody = {
          subject: session.subject,

          duration_seconds:
            durationSeconds,

          started_at:
            new Date(
              session.startedAt,
            ).toISOString(),

          ended_at:
            new Date(
              endedAtTimestamp,
            ).toISOString(),
        };

        try {
          const response = await fetch(
            saveRecordUrl,
            {
              method: "POST",

              credentials:
                "same-origin",

              headers: {
                Accept:
                  "application/json",

                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify(
                  requestBody,
                ),
            },
          );

          let result = {};

          try {
            result =
              await response.json();
          } catch (error) {
            console.error(
              "공부 기록 응답 변환 오류:",
              error,
            );
          }

          if (response.status === 401) {
            throw new Error(
              "로그인이 만료되었습니다. 다시 로그인해 주세요.",
            );
          }

          if (!response.ok) {
            throw new Error(
              result.message ||
                result.error ||
                "공부 기록 저장에 실패했습니다.",
            );
          }

          /*
           * 서버 저장 성공 후에만 진행 중 세션을 삭제한다.
           */
          removeSession();

          window.location.replace(
            dashboardUrl,
          );
        } catch (error) {
          console.error(
            "공부 기록 저장 오류:",
            error,
          );

          if (stopConfirmModal) {
            stopConfirmModal.hidden =
              true;
          }

          document.body.style.overflow =
            "";

          showMessage(
            error.message ||
              "공부 기록 저장 중 오류가 발생했습니다.",
          );

          setSavingState(false);

          /*
           * 저장 실패 시 기존 집중 세션을 유지한다.
           */
          saveSession();
          updateStatusUI();
          updateTimerUI();

          if (!session.isPaused) {
            startTimerInterval();
          }
        }
      }

      // =========================================================
      // 대시보드 이동
      // =========================================================

      function handleBackNavigation(
        event,
      ) {
        event.preventDefault();

        if (isSaving) {
          return;
        }

        const shouldLeave =
          window.confirm(
            "집중모드를 나가면 타이머가 일시정지됩니다. 대시보드로 이동할까요?",
          );

        if (!shouldLeave) {
          return;
        }

        /*
         * 사용자가 대시보드 이동을 직접 선택했으므로
         * 수동 일시정지 상태로 남긴다.
         *
         * 따라서 대시보드에서 다시 집중모드로 돌아와도
         * 자동 재개되지 않는다.
         */
        if (!session.isPaused) {
          pauseStudy({
            automatic: false,
          });
        } else {
          session.automaticallyPaused =
            false;

          saveSession();
          updateStatusUI();
        }

        window.location.href =
          dashboardUrl;
      }

      // =========================================================
      // 키보드
      // =========================================================

      function handleKeyDown(event) {
        if (
          event.key !== "Escape" ||
          !stopConfirmModal ||
          stopConfirmModal.hidden ||
          isSaving
        ) {
          return;
        }

        closeStopModal();
      }

      // =========================================================
      // 이벤트 연결
      // =========================================================

      function bindEvents() {
        pauseButton?.addEventListener(
          "click",
          togglePause,
        );

        stopButton?.addEventListener(
          "click",
          openStopModal,
        );

        cancelStopButton
          ?.addEventListener(
            "click",
            closeStopModal,
          );

        confirmStopButton
          ?.addEventListener(
            "click",
            stopStudy,
          );

        stopConfirmBackdrop
          ?.addEventListener(
            "click",
            () => {
              if (!isSaving) {
                closeStopModal();
              }
            },
          );

        backLink?.addEventListener(
          "click",
          handleBackNavigation,
        );

        document.addEventListener(
          "keydown",
          handleKeyDown,
        );

        document.addEventListener(
          "visibilitychange",
          handleVisibilityChange,
        );

        window.addEventListener(
          "pagehide",
          handlePageHide,
        );

        window.addEventListener(
          "pageshow",
          handlePageShow,
        );

        window.addEventListener(
          "focus",
          handleWindowFocus,
        );

        /*
         * 브라우저 탭을 닫거나 새로고침하기 전에
         * 마지막 세션 상태를 저장한다.
         */
        window.addEventListener(
          "beforeunload",
          () => {
            if (!isSaving) {
              saveSession();
            }
          },
        );
      }

      // =========================================================
      // 초기화
      // =========================================================

      function initializePage() {
        if (!subject) {
          window.location.replace(
            dashboardUrl,
          );

          return;
        }

        session = loadSession();

        if (!session) {
          session = createNewSession();
          saveSession();
        }

        if (startedAtElement) {
          startedAtElement.textContent =
            `${formatDateTime(
              session.startedAt,
            )}부터 측정 중`;
        }

        bindEvents();

        /*
         * 이전 버전에서 화면 이탈로 자동 일시정지된 세션이
         * localStorage에 남아 있다면 한 번만 정상 상태로 복구한다.
         *
         * 화면을 벗어나 있던 시간도 공부시간으로 포함해야 하므로
         * totalPausedMilliseconds에는 추가하지 않는다.
         */
        if (
          session.isPaused &&
          session.automaticallyPaused
        ) {
          session.pausedAt = null;
          session.isPaused = false;
          session.automaticallyPaused =
            false;

          saveSession();
        }

        updateStatusUI();
        updateTimerUI();

        if (!session.isPaused) {
          startTimerInterval();
        }
      }

      initializePage();
    })();
