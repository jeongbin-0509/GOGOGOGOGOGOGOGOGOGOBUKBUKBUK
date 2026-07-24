(() => {
  "use strict";

  const data = window.FOCUS_PAGE_DATA || {};
  const subject = String(data.subject || "기타").trim();
  const dashboardUrl = String(data.dashboardUrl || "/");
  const startUrl = String(data.startSessionUrl || "/api/focus-session/start");
  const statusUrl = String(data.statusSessionUrl || "/api/focus-session/status");
  const stopUrl = String(data.stopSessionUrl || "/api/focus-session/stop");
  const eventsUrl = String(data.eventsSessionUrl || "/api/focus-session/events");
  const goalSeconds = Math.max(1, Number(data.goalSeconds) || 28800);
  const baseTodaySeconds = Math.max(0, Number(data.todaySeconds) || 0);

  const subjectTitle = document.getElementById("focusSubject");
  const timer = document.getElementById("focusTimer");
  const todayTotal = document.getElementById("focusTodayTotal");
  const goalText = document.getElementById("focusGoalText");
  const goalRate = document.getElementById("focusGoalRate");
  const goalProgress = document.getElementById("focusGoalProgress");
  const goalProgressBar = document.getElementById("focusGoalProgressBar");
  const grade = document.getElementById("focusGrade");
  const gradeMessage = document.getElementById("focusGradeMessage");
  const statusBadge = document.getElementById("focusStatusBadge");
  const startedAtText = document.getElementById("focusStartedAt");
  const message = document.getElementById("focusMessage");
  const backLink = document.getElementById("focusBackLink");
  const dashboardButton = document.getElementById("pauseStudyButton");
  const stopButton = document.getElementById("stopStudyButton");
  const modal = document.getElementById("stopConfirmModal");
  const backdrop = document.getElementById("stopConfirmBackdrop");
  const cancelButton = document.getElementById("cancelStopButton");
  const confirmButton = document.getElementById("confirmStopButton");

  let activeSession = null;
  let intervalId = null;
  let eventSource = null;
  let stopping = false;
  let remoteEndHandled = false;

  function getClientToken() {
    const key = "focusDeviceToken";
    let token = localStorage.getItem(key);
    if (!token) {
      token = crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(key, token);
    }
    return token;
  }

  const clientToken = getClientToken();

  async function api(url, options = {}) {
    const response = await fetch(url, {
      method: options.method || "GET",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const result = await response.json().catch(() => ({}));
    if (response.status === 401) {
      location.href = "/login";
      throw new Error("로그인이 필요합니다.");
    }
    if (!response.ok) throw new Error(result.message || "요청 처리에 실패했습니다.");
    return result;
  }

  function formatTime(value) {
    const seconds = Math.max(0, Math.floor(Number(value) || 0));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map(v => String(v).padStart(2, "0")).join(":");
  }

  function elapsedSeconds() {
    if (!activeSession?.started_at) return 0;
    const started = new Date(activeSession.started_at).getTime();
    return Math.max(0, Math.floor((Date.now() - started) / 1000));
  }

  function gradeFor(seconds) {
    if (seconds >= 12 * 3600) return 1;
    if (seconds >= 8 * 3600) return 2;
    if (seconds >= 5 * 3600) return 3;
    if (seconds >= 3 * 3600) return 4;
    return 5;
  }

  function render() {
    const sessionSeconds = elapsedSeconds();
    const total = baseTodaySeconds + sessionSeconds;
    const rate = Math.min(100, Math.floor((total / goalSeconds) * 100));
    const currentGrade = gradeFor(total);

    timer.textContent = formatTime(sessionSeconds);
    todayTotal.textContent = formatTime(total);
    goalText.textContent = `${Math.floor(total / 60)} / ${Math.floor(goalSeconds / 60)}분`;
    goalRate.textContent = `${rate}%`;
    goalProgress.style.width = `${rate}%`;
    goalProgressBar?.setAttribute("aria-valuenow", String(rate));
    grade.textContent = `${currentGrade}등급`;
    gradeMessage.textContent = "공부시간은 서버의 시작·종료 시각으로 계산됩니다.";
  }

  function showError(text) {
    message.hidden = false;
    message.textContent = text;
    message.dataset.type = "error";
  }

  function openModal() {
    modal.hidden = false;
  }

  function closeModal() {
    modal.hidden = true;
  }


  function closeSessionEvents() {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  }

  function handleRemoteSessionEnd() {
    if (stopping || remoteEndHandled) return;
    remoteEndHandled = true;
    closeSessionEvents();
    clearInterval(intervalId);
    activeSession = null;
    localStorage.removeItem("activeStudySession");
    statusBadge.textContent = "종료됨";
    stopButton.disabled = true;
    dashboardButton.disabled = true;
    alert("다른 기기에서 집중 세션이 종료되었습니다.");
    location.href = dashboardUrl;
  }

  function watchSessionEvents(session) {
    closeSessionEvents();
    remoteEndHandled = false;

    if (!session?.id || typeof EventSource === "undefined") return;

    const url = `${eventsUrl}?session_id=${encodeURIComponent(session.id)}`;
    eventSource = new EventSource(url, { withCredentials: true });

    eventSource.addEventListener("focus-ended", handleRemoteSessionEnd);

    // EventSource는 일시적인 네트워크 단절 시 자동 재연결한다.
    // 따라서 error 이벤트에서는 화면을 종료하지 않는다.
    eventSource.addEventListener("focus-error", event => {
      console.warn("집중 세션 실시간 감시 오류:", event.data);
    });
  }

  function applySession(session) {
    activeSession = session;

    if (subjectTitle && activeSession?.subject) {
      subjectTitle.textContent = activeSession.subject;
      document.title = `${activeSession.subject} 집중 모드 | 돼지런한 여름방학`;
    }

    statusBadge.textContent = "공부 중";
    startedAtText.textContent = `${new Date(activeSession.started_at).toLocaleString("ko-KR")} 시작`;

    clearInterval(intervalId);
    render();
    intervalId = setInterval(render, 1000);
    watchSessionEvents(activeSession);
  }

  async function start() {
    const result = await api(startUrl, {
      method: "POST",
      body: { subject, client_token: clientToken },
    });
    applySession(result.session);
  }

  async function initialize() {
    try {
      // 페이지 진입 시 먼저 서버의 기존 활성 세션을 확인한다.
      // 다른 기기에서 시작한 세션이 있으면 새로 만들지 않고 그대로 복원한다.
      const status = await api(statusUrl);

      if (status.active && status.session) {
        applySession(status.session);
        return;
      }

      await start();
    } catch (error) {
      statusBadge.textContent = "시작 실패";
      showError(error.message);
      stopButton.disabled = true;
      dashboardButton.textContent = "대시보드로 돌아가기";
    }
  }

  async function stop() {
    if (stopping || !activeSession) return;
    stopping = true;
    closeSessionEvents();
    confirmButton.disabled = true;
    confirmButton.textContent = "저장 중...";

    try {
      await api(stopUrl, {
        method: "POST",
        body: {},
      });
      clearInterval(intervalId);
      localStorage.removeItem("activeStudySession");
      location.href = dashboardUrl;
    } catch (error) {
      closeModal();
      showError(error.message);
      stopping = false;
      confirmButton.disabled = false;
      confirmButton.textContent = "종료하고 저장";
    }
  }

  backLink?.addEventListener("click", () => localStorage.removeItem("activeStudySession"));
  dashboardButton?.addEventListener("click", () => { location.href = dashboardUrl; });
  stopButton?.addEventListener("click", openModal);
  backdrop?.addEventListener("click", closeModal);
  cancelButton?.addEventListener("click", closeModal);
  confirmButton?.addEventListener("click", stop);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !modal.hidden) closeModal();
  });

  window.addEventListener("beforeunload", closeSessionEvents);

  initialize();
})();
