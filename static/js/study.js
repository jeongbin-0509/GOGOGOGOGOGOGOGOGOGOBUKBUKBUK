document.addEventListener("DOMContentLoaded", () => {
  const pageData = window.STUDY_PAGE_DATA || {};

  // 타이머 관련 요소
  const todayStudyTime = document.getElementById("todayStudyTime");

  const timerStatusBadge = document.getElementById("timerStatusBadge");

  const goalPercentage = document.getElementById("goalPercentage");

  const goalProgressFill = document.getElementById("goalProgressFill");

  const timerSubject = document.getElementById("timerSubject");

  const startStudyButton = document.getElementById("startStudyButton");

  const stopStudyButton = document.getElementById("stopStudyButton");

  const timerMessage = document.getElementById("timerMessage");

  /*
   * index.html에서 다음과 같이 전달받는 것을 기준으로 함.
   *
   * window.STUDY_PAGE_DATA = {
   *     todaySeconds: ...,
   *     goalSeconds: ...
   * };
   */
  const baseTodaySeconds = Number(
    todayStudyTime?.dataset.seconds ?? pageData.todaySeconds ?? 0,
  );

  const goalSeconds = Number(pageData.goalSeconds || 28800);

  let sessionSeconds = 0;
  let timerState = "idle";

  let startedAt = null;
  let timerInterval = null;
  let previousTickTime = null;

  // 초를 00:00:00 형식으로 변환
  function formatTime(seconds) {
    const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));

    const hours = String(Math.floor(safeSeconds / 3600)).padStart(2, "0");

    const minutes = String(Math.floor((safeSeconds % 3600) / 60)).padStart(
      2,
      "0",
    );

    const secs = String(safeSeconds % 60).padStart(2, "0");

    return `${hours}:${minutes}:${secs}`;
  }

  // 오류 또는 성공 메시지 표시
  function showMessage(element, message, type = "error") {
    if (!element) {
      if (type === "error") {
        window.alert(message);
      }

      return;
    }

    element.textContent = message;
    element.className = `form-message ${type}`;
    element.hidden = false;
  }

  // 메시지 숨기기
  function hideMessage(element) {
    if (!element) {
      return;
    }

    element.textContent = "";
    element.className = "form-message";
    element.hidden = true;
  }

  // 서버 응답 JSON 읽기
  async function readJsonResponse(response) {
    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      const text = await response.text();

      console.error("JSON이 아닌 서버 응답:", response.status, text);

      throw new Error(`서버 응답 오류 (${response.status})`);
    }

    return response.json();
  }

  // 서버 API 요청
  async function requestJson(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      ...options,

      headers: {
        ...(options.body
          ? {
              "Content-Type": "application/json",
            }
          : {}),

        ...(options.headers || {}),
      },
    });

    const result = await readJsonResponse(response);

    if (response.status === 401 && result.redirect) {
      window.location.href = result.redirect;

      throw new Error("로그인이 필요합니다.");
    }

    if (!response.ok || result.success === false) {
      throw new Error(result.message || "요청 처리에 실패했습니다.");
    }

    return result;
  }

  // 타이머 및 목표 진행률 화면 갱신
  function updateTimerDisplay() {
    const totalSeconds = baseTodaySeconds + sessionSeconds;

    if (todayStudyTime) {
      todayStudyTime.textContent = formatTime(totalSeconds);
    }

    const percentage =
      goalSeconds > 0
        ? Math.min(100, Math.round((totalSeconds / goalSeconds) * 100))
        : 0;

    if (goalPercentage) {
      goalPercentage.textContent = `${percentage}%`;
    }

    if (goalProgressFill) {
      goalProgressFill.style.width = `${percentage}%`;
    }
  }

  // 타이머 상태에 따라 버튼과 표시 변경
  function updateTimerState(nextState) {
    timerState = nextState;

    if (timerStatusBadge) {
      timerStatusBadge.className = "badge";
    }

    if (nextState === "running") {
      if (timerStatusBadge) {
        timerStatusBadge.textContent = "공부 중";

        timerStatusBadge.classList.add("badge-success");
      }

      if (startStudyButton) {
        startStudyButton.disabled = true;

        startStudyButton.textContent = "공부 중";
      }

      if (stopStudyButton) {
        stopStudyButton.disabled = false;
      }

      showMessage(
        timerMessage,
        "현재 집중 시간이 기록되고 있습니다.",
        "success",
      );

      return;
    }

    if (nextState === "paused") {
      if (timerStatusBadge) {
        timerStatusBadge.textContent = "일시정지";

        timerStatusBadge.classList.add("badge-warning");
      }

      if (startStudyButton) {
        startStudyButton.disabled = false;

        startStudyButton.textContent = "공부 계속하기";
      }

      if (stopStudyButton) {
        stopStudyButton.disabled = false;
      }

      showMessage(
        timerMessage,
        "화면을 벗어나 타이머가 일시정지되었습니다.",
        "error",
      );

      return;
    }

    if (timerStatusBadge) {
      timerStatusBadge.textContent = "대기 중";

      timerStatusBadge.classList.add("badge-idle");
    }

    if (startStudyButton) {
      startStudyButton.disabled = false;

      startStudyButton.textContent = "공부 시작";
    }

    if (stopStudyButton) {
      stopStudyButton.disabled = true;

      stopStudyButton.textContent = "공부 종료";
    }

    hideMessage(timerMessage);
  }

  // 실제로 흐른 시간을 계산
  function updateElapsedTime() {
    if (timerState !== "running" || previousTickTime === null) {
      return;
    }

    const currentTime = Date.now();

    const elapsedMilliseconds = currentTime - previousTickTime;

    if (elapsedMilliseconds < 1000) {
      return;
    }

    const elapsedSeconds = Math.floor(elapsedMilliseconds / 1000);

    sessionSeconds += elapsedSeconds;

    previousTickTime += elapsedSeconds * 1000;

    updateTimerDisplay();
  }

  // 공부 시작 또는 재개
  function startTimer() {
    if (timerState === "running") {
      return;
    }

    const subject = timerSubject?.value.trim() || "";

    if (!subject) {
      showMessage(timerMessage, "공부할 과목을 입력해 주세요.");

      timerSubject?.focus();
      return;
    }

    if (timerState === "idle") {
      sessionSeconds = 0;

      startedAt = new Date().toISOString();
    }

    hideMessage(timerMessage);

    previousTickTime = Date.now();

    if (timerInterval !== null) {
      clearInterval(timerInterval);
    }

    timerInterval = window.setInterval(updateElapsedTime, 250);

    updateTimerState("running");
  }

  // 타이머 일시정지
  function pauseTimer() {
    if (timerState !== "running") {
      return;
    }

    updateElapsedTime();

    if (timerInterval !== null) {
      clearInterval(timerInterval);
    }

    timerInterval = null;
    previousTickTime = null;

    updateTimerState("paused");
  }

  // 타이머 초기화
  function resetTimer() {
    if (timerInterval !== null) {
      clearInterval(timerInterval);
    }

    timerInterval = null;
    previousTickTime = null;
    sessionSeconds = 0;
    startedAt = null;

    if (timerSubject) {
      timerSubject.value = "";
    }

    updateTimerDisplay();
    updateTimerState("idle");
  }

  // 타이머 공부 기록 저장
  async function saveTimerRecord() {
    if (timerState === "running") {
      pauseTimer();
    }

    if (sessionSeconds < 10) {
      showMessage(timerMessage, "10초 이상 공부한 뒤 종료해 주세요.");

      return;
    }

    const subject = timerSubject?.value.trim() || "";

    if (!subject) {
      showMessage(timerMessage, "공부한 과목을 입력해 주세요.");

      timerSubject?.focus();
      return;
    }

    const confirmed = window.confirm(
      `${subject} 공부 기록 ` +
        `${formatTime(sessionSeconds)}을 ` +
        "저장할까요?",
    );

    if (!confirmed) {
      return;
    }

    if (stopStudyButton) {
      stopStudyButton.disabled = true;

      stopStudyButton.textContent = "저장 중...";
    }

    try {
      await requestJson("/api/study-records", {
        method: "POST",

        body: JSON.stringify({
          subject,

          duration_seconds: sessionSeconds,

          started_at: startedAt,

          ended_at: new Date().toISOString(),
        }),
      });

      resetTimer();

      window.location.reload();
    } catch (error) {
      console.error("공부 기록 저장 오류:", error);

      showMessage(
        timerMessage,
        error.message || "공부 기록 저장 중 오류가 발생했습니다.",
      );

      if (stopStudyButton) {
        stopStudyButton.disabled = false;

        stopStudyButton.textContent = "공부 종료";
      }
    }
  }

  // 공부 기록 삭제
  async function deleteStudyRecord(button) {
    const recordId = button.dataset.recordId || button.dataset.deleteRecord;

    if (!recordId) {
      console.error("삭제할 기록 ID가 없습니다.");

      return;
    }

    const confirmed = window.confirm("이 공부 기록을 삭제할까요?");

    if (!confirmed) {
      return;
    }

    const originalText = button.textContent;

    button.disabled = true;
    button.textContent = "삭제 중";

    try {
      await requestJson(`/api/study-records/${recordId}`, {
        method: "DELETE",
      });

      const recordItem = button.closest(".record-item");

      if (recordItem) {
        recordItem.remove();
      }

      window.location.reload();
    } catch (error) {
      console.error("공부 기록 삭제 오류:", error);

      window.alert(error.message || "공부 기록 삭제 중 오류가 발생했습니다.");

      button.disabled = false;
      button.textContent = originalText;
    }
  }

  // 공부 시작
  startStudyButton?.addEventListener("click", startTimer);

  // 공부 종료 및 저장
  stopStudyButton?.addEventListener("click", saveTimerRecord);

  // 기록 삭제 버튼
  document
    .querySelectorAll(".record-delete-button, " + "[data-delete-record]")
    .forEach((button) => {
      button.addEventListener("click", () => deleteStudyRecord(button));
    });

  // 다른 탭으로 이동하면 타이머 일시정지
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && timerState === "running") {
      pauseTimer();
    }
  });

  // 브라우저 창이 포커스를 잃으면 일시정지
  window.addEventListener("blur", () => {
    if (timerState === "running") {
      pauseTimer();
    }
  });

  // 타이머 작동 중 페이지를 나갈 때 경고
  window.addEventListener("beforeunload", (event) => {
    if (timerState === "running" || timerState === "paused") {
      event.preventDefault();
      event.returnValue = "";
    }
  });

  updateTimerDisplay();
  updateTimerState("idle");
});
