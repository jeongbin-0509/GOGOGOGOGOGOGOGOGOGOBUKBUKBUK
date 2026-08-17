"use strict";

// =========================================================
// DOM
// =========================================================

const todayStudyTimeDOM = document.getElementById("todayStudyTime");
const dailyGoalTextDOM = document.getElementById("dailyGoalText");
const dailyGoalProgressDOM = document.getElementById(
  "dailyGoalProgress",
);

const progressBarDOM = document.querySelector(".progress-bar");

const studyStatusBadgeDOM = document.getElementById(
  "studyStatusBadge",
);

const subjectListDOM = document.getElementById("subjectList");
const timerSubjectDOM = document.getElementById("timerSubject");

const startStudyButton = document.getElementById(
  "startStudyButton",
);

const dashboardMessageDOM = document.getElementById(
  "dashboardMessage",
);

const todayRecordListDOM = document.getElementById(
  "todayRecordList",
);

const todayRecordCountDOM = document.getElementById(
  "todayRecordCount",
);

const gradeDisplayDOM = document.getElementById("gradeDisplay");
const gradeNumberDOM = document.getElementById("gradeNumber");

const gradeDescriptionDOM = document.getElementById(
  "gradeDescription",
);

const nextGradeRemainingDOM = document.getElementById(
  "nextGradeRemaining",
);

const gradeMotivationDOM = document.getElementById(
  "gradeMotivation",
);

const totalStudyHoursDOM = document.getElementById(
  "totalStudyHours",
);

const totalStudyDetailDOM = document.getElementById(
  "totalStudyDetail",
);

const personalRankDOM = document.getElementById("personalRank");
const classRankDOM = document.getElementById("classRank");

const userNameDOM = document.getElementById("userName");
const userInfoDOM = document.getElementById("userInfo");

const logoutButton = document.getElementById("logoutButton");

const mobileLogoutButton = document.getElementById(
  "mobileLogoutButton",
);

// 집중 모드
const focusModeDOM = document.getElementById("focusMode");

const focusSubjectNameDOM = document.getElementById(
  "focusSubjectName",
);

const focusStatusBadgeDOM = document.getElementById(
  "focusStatusBadge",
);

const focusTimerDOM = document.getElementById("focusTimer");

const focusTodayTotalDOM = document.getElementById(
  "focusTodayTotal",
);

const focusGradeDOM = document.getElementById("focusGrade");
const focusGoalRateDOM = document.getElementById("focusGoalRate");

const focusGradeProgressDOM = document.getElementById(
  "focusGradeProgress",
);

const pauseStudyButton = document.getElementById(
  "pauseStudyButton",
);

const stopStudyButton = document.getElementById(
  "stopStudyButton",
);

// 과목 관리
const subjectEditorModalDOM = document.getElementById(
  "subjectEditorModal",
);

const openSubjectEditorButton = document.getElementById(
  "openSubjectEditorButton",
);

const closeSubjectEditorButton = document.getElementById(
  "closeSubjectEditorButton",
);

const finishSubjectEditorButton = document.getElementById(
  "finishSubjectEditorButton",
);

const subjectEditorBackdropDOM = document.getElementById(
  "subjectEditorBackdrop",
);

const subjectAddForm = document.getElementById("subjectAddForm");

const newSubjectInputDOM = document.getElementById(
  "newSubjectInput",
);

const subjectEditorListDOM = document.getElementById(
  "subjectEditorList",
);

const subjectEditorMessageDOM = document.getElementById(
  "subjectEditorMessage",
);

// =========================================================
// 상태
// =========================================================

const DAILY_GOAL_MINUTES = 180;

let dashboardData = null;
let subjects = [];
let selectedSubjectId = null;
let selectedSubjectName = "";

let studySession = null;
let timerInterval = null;

// =========================================================
// API
// =========================================================

async function apiRequest(url, options = {}) {
  const requestOptions = {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    credentials: "same-origin",
  };

  if (options.body !== undefined) {
    requestOptions.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, requestOptions);

  let result = null;

  try {
    result = await response.json();
  } catch {
    result = null;
  }

  if (response.status === 401) {
    location.href = "/login";
    throw new Error("로그인이 필요합니다.");
  }

  if (!response.ok) {
    const message =
      result?.message ||
      result?.error ||
      "요청을 처리하지 못했습니다.";

    throw new Error(message);
  }

  return result;
}

// =========================================================
// 공통 함수
// =========================================================

function escapeHTML(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}

function formatSeconds(totalSeconds) {
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0);

  const hours = Math.floor(safeSeconds / 3600);

  const minutes = Math.floor(
    (safeSeconds % 3600) / 60,
  );

  const seconds = Math.floor(safeSeconds % 60);

  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    String(seconds).padStart(2, "0"),
  ].join(":");
}

function formatMinutesToText(totalMinutes) {
  const safeMinutes = Math.max(
    0,
    Math.floor(Number(totalMinutes) || 0),
  );

  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;

  if (hours === 0) {
    return `${minutes}분`;
  }

  if (minutes === 0) {
    return `${hours}시간`;
  }

  return `${hours}시간 ${minutes}분`;
}

function showMessage(element, message, type = "error") {
  if (!element) {
    return;
  }

  element.textContent = message;
  element.classList.toggle("success", type === "success");
  element.hidden = false;
}

function hideMessage(element) {
  if (!element) {
    return;
  }

  element.hidden = true;
  element.textContent = "";
  element.classList.remove("success");
}

function getGradeByMinutes(minutes) {
  const studyMinutes = Math.max(
    0,
    Number(minutes) || 0,
  );

  if (studyMinutes >= 360) {
    return 1;
  }

  if (studyMinutes >= 300) {
    return 2;
  }

  if (studyMinutes >= 240) {
    return 3;
  }

  if (studyMinutes >= 180) {
    return 4;
  }

  return 5;
}

function getNextGradeInformation(minutes) {
  const studyMinutes = Math.max(
    0,
    Math.floor(Number(minutes) || 0),
  );

  if (studyMinutes >= 360) {
    return {
      remaining: 0,
      text: "최고 등급을 달성했습니다.",
    };
  }

  const gradeTargets = [
    {
      target: 180,
      grade: 4,
    },
    {
      target: 240,
      grade: 3,
    },
    {
      target: 300,
      grade: 2,
    },
    {
      target: 360,
      grade: 1,
    },
  ];

  const nextTarget = gradeTargets.find(
    (item) => studyMinutes < item.target,
  );

  return {
    remaining: nextTarget.target - studyMinutes,
    text: `${nextTarget.grade}등급까지 ${nextTarget.target - studyMinutes}분 남았습니다.`,
  };
}

function calculateCurrentSessionSeconds() {
  if (!studySession) {
    return 0;
  }

  const savedSeconds =
    Number(studySession.accumulated_seconds) || 0;

  if (studySession.status !== "running") {
    return savedSeconds;
  }

  const startedAt = new Date(studySession.started_at).getTime();

  if (!Number.isFinite(startedAt)) {
    return savedSeconds;
  }

  const elapsedSeconds = Math.floor(
    (Date.now() - startedAt) / 1000,
  );

  return savedSeconds + Math.max(0, elapsedSeconds);
}

// =========================================================
// 대시보드 데이터 불러오기
// =========================================================

async function loadDashboard() {
  hideMessage(dashboardMessageDOM);

  try {
    const result = await apiRequest("/api/dashboard");

    dashboardData = result;

    subjects = Array.isArray(result.subjects)
      ? result.subjects
      : [];

    studySession = result.active_session || null;

    renderDashboard(result);
    restoreActiveSession();
  } catch (error) {
    console.error(error);

    showMessage(
      dashboardMessageDOM,
      error.message,
    );
  }
}

function renderDashboard(data) {
  const todaySeconds =
    Number(data.today_study_seconds) || 0;

  const totalSeconds =
    Number(data.total_study_seconds) || 0;

  const todayMinutes = Math.floor(todaySeconds / 60);
  const totalMinutes = Math.floor(totalSeconds / 60);

  todayStudyTimeDOM.textContent =
    formatSeconds(todaySeconds);

  renderGoal(todayMinutes);
  renderGrade(todayMinutes);
  renderSubjects();
  renderRecords(data.today_records || []);
  renderUser(data.user || {});
  renderRanks(data.ranking || {});

  totalStudyHoursDOM.textContent = (
    totalSeconds / 3600
  ).toFixed(totalSeconds >= 36000 ? 0 : 1);

  totalStudyDetailDOM.textContent =
    `총 ${formatMinutesToText(totalMinutes)} 동안 공부했습니다.`;
}

function renderGoal(todayMinutes) {
  const percentage = Math.min(
    100,
    Math.floor(
      (todayMinutes / DAILY_GOAL_MINUTES) * 100,
    ),
  );

  dailyGoalTextDOM.textContent =
    `${todayMinutes} / ${DAILY_GOAL_MINUTES}분`;

  dailyGoalProgressDOM.style.width = `${percentage}%`;

  progressBarDOM?.setAttribute(
    "aria-valuenow",
    String(percentage),
  );
}

function renderGrade(todayMinutes) {
  const grade = getGradeByMinutes(todayMinutes);

  gradeNumberDOM.textContent = String(grade);

  gradeDisplayDOM.className =
    `grade-display grade-${grade}`;

  document
    .querySelectorAll(".grade-scale-item")
    .forEach((item) => {
      item.classList.toggle(
        "active",
        Number(item.dataset.grade) === grade,
      );
    });

  const descriptions = {
    1: "오늘 최고 등급을 달성했습니다.",
    2: "최고 등급까지 조금만 더 힘내세요.",
    3: "오늘 충분히 집중하고 있습니다.",
    4: "오늘의 기본 목표를 달성했습니다.",
    5: "공부를 시작하고 등급을 올려보세요.",
  };

  const motivations = {
    1: "대단합니다. 오늘 하루를 완벽하게 활용했습니다.",
    2: "지금의 집중력을 조금만 더 유지해 보세요.",
    3: "좋은 흐름입니다. 꾸준히 이어가 보세요.",
    4: "목표 달성을 축하합니다.",
    5: "작은 시작이 큰 변화를 만듭니다.",
  };

  gradeDescriptionDOM.textContent =
    descriptions[grade];

  gradeMotivationDOM.textContent =
    motivations[grade];

  const nextGrade =
    getNextGradeInformation(todayMinutes);

  nextGradeRemainingDOM.textContent =
    nextGrade.remaining === 0
      ? "달성 완료"
      : `${nextGrade.remaining}분`;
}

function renderUser(user) {
  userNameDOM.textContent =
    user.name || "사용자";

  const information = [
    user.student_number,
    user.class_name,
  ].filter(Boolean);

  userInfoDOM.textContent =
    information.length > 0
      ? information.join(" · ")
      : "돼지런한 여름방학에 참여하고 있습니다.";
}

function renderRanks(ranking) {
  personalRankDOM.textContent =
    ranking.personal_rank
      ? `${ranking.personal_rank}위`
      : "-위";

  classRankDOM.textContent =
    ranking.class_rank
      ? `${ranking.class_rank}위`
      : "-위";
}

// =========================================================
// 과목
// =========================================================

function renderSubjects() {
  subjectListDOM.innerHTML = "";

  if (subjects.length === 0) {
    selectedSubjectId = null;
    selectedSubjectName = "";
    timerSubjectDOM.value = "";

    updateStartButton();
    renderSubjectEditorList();

    return;
  }

  subjects.forEach((subject) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "subject-choice-button";
    button.dataset.subjectId = String(subject.id);
    button.textContent = subject.name;

    button.classList.toggle(
      "selected",
      String(selectedSubjectId) === String(subject.id),
    );

    button.addEventListener("click", () => {
      selectSubject(subject);
    });

    subjectListDOM.appendChild(button);
  });

  renderSubjectEditorList();
}

function selectSubject(subject) {
  selectedSubjectId = subject.id;
  selectedSubjectName = subject.name;

  timerSubjectDOM.value = String(subject.id);

  document
    .querySelectorAll(".subject-choice-button")
    .forEach((button) => {
      button.classList.toggle(
        "selected",
        button.dataset.subjectId ===
          String(subject.id),
      );
    });

  updateStartButton();
}

function updateStartButton() {
  if (!selectedSubjectId) {
    startStudyButton.disabled = true;
    startStudyButton.textContent =
      "과목을 선택해 주세요";

    return;
  }

  startStudyButton.disabled = false;
  startStudyButton.textContent =
    `${selectedSubjectName} 공부 시작`;
}

// =========================================================
// 기록
// =========================================================

function renderRecords(records) {
  todayRecordListDOM.innerHTML = "";
  todayRecordCountDOM.textContent = `${records.length}개`;

  if (records.length === 0) {
    todayRecordListDOM.innerHTML = `
      <p class="empty-message">
        아직 등록된 공부 기록이 없습니다.
      </p>
    `;

    return;
  }

  records.forEach((record) => {
    const item = document.createElement("div");
    item.className = "record-item";

    const durationSeconds =
      Number(record.duration_seconds) || 0;

    const createdAt = record.created_at
      ? new Date(record.created_at)
      : null;

    const dateText =
      createdAt && !Number.isNaN(createdAt.getTime())
        ? createdAt.toLocaleTimeString("ko-KR", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "";

    item.innerHTML = `
      <div class="record-info">
        <strong>${escapeHTML(record.subject_name || "과목")}</strong>
        <span class="record-date">${escapeHTML(dateText)}</span>
      </div>

      <div class="record-actions">
        <span>${formatSeconds(durationSeconds)}</span>

        <button
          class="record-delete-button"
          type="button"
          data-record-id="${escapeHTML(record.id)}"
        >
          삭제
        </button>
      </div>
    `;

    const deleteButton = item.querySelector(
      ".record-delete-button",
    );

    deleteButton.addEventListener("click", () => {
      deleteRecord(record.id);
    });

    todayRecordListDOM.appendChild(item);
  });
}

async function deleteRecord(recordId) {
  const confirmed = confirm(
    "이 공부 기록을 삭제하시겠습니까?",
  );

  if (!confirmed) {
    return;
  }

  try {
    await apiRequest(`/api/study/records/${recordId}`, {
      method: "DELETE",
    });

    await loadDashboard();
  } catch (error) {
    showMessage(
      dashboardMessageDOM,
      error.message,
    );
  }
}

// =========================================================
// 공부 타이머
// =========================================================

async function startStudy() {
  if (!selectedSubjectId) {
    showMessage(
      dashboardMessageDOM,
      "공부할 과목을 선택해 주세요.",
    );

    return;
  }

  startStudyButton.disabled = true;
  hideMessage(dashboardMessageDOM);

  try {
    const result = await apiRequest("/api/study/start", {
      method: "POST",
      body: {
        subject_id: selectedSubjectId,
      },
    });

    studySession = result.session || {
      id: result.id,
      subject_id: selectedSubjectId,
      subject_name: selectedSubjectName,
      status: "running",
      started_at: new Date().toISOString(),
      accumulated_seconds: 0,
    };

    openFocusMode();
    startTimerInterval();
  } catch (error) {
    showMessage(
      dashboardMessageDOM,
      error.message,
    );

    updateStartButton();
  }
}

async function togglePauseStudy() {
  if (!studySession) {
    return;
  }

  pauseStudyButton.disabled = true;

  try {
    if (studySession.status === "running") {
      const currentSeconds =
        calculateCurrentSessionSeconds();

      const result = await apiRequest(
        "/api/study/pause",
        {
          method: "POST",
          body: {
            session_id: studySession.id,
          },
        },
      );

      studySession = result.session || {
        ...studySession,
        status: "paused",
        accumulated_seconds: currentSeconds,
        started_at: null,
      };
    } else {
      const result = await apiRequest(
        "/api/study/resume",
        {
          method: "POST",
          body: {
            session_id: studySession.id,
          },
        },
      );

      studySession = result.session || {
        ...studySession,
        status: "running",
        started_at: new Date().toISOString(),
      };
    }

    updateFocusMode();
  } catch (error) {
    alert(error.message);
  } finally {
    pauseStudyButton.disabled = false;
  }
}

async function stopStudy() {
  if (!studySession) {
    return;
  }

  const confirmed = confirm(
    "공부를 종료하고 현재 시간을 기록하시겠습니까?",
  );

  if (!confirmed) {
    return;
  }

  stopStudyButton.disabled = true;
  pauseStudyButton.disabled = true;

  try {
    await apiRequest("/api/study/stop", {
      method: "POST",
      body: {
        session_id: studySession.id,
      },
    });

    clearTimerInterval();

    studySession = null;

    closeFocusMode();

    await loadDashboard();
  } catch (error) {
    alert(error.message);
  } finally {
    stopStudyButton.disabled = false;
    pauseStudyButton.disabled = false;
  }
}

function restoreActiveSession() {
  if (!studySession) {
    return;
  }

  selectedSubjectId = studySession.subject_id;
  selectedSubjectName =
    studySession.subject_name || "선택한 과목";

  openFocusMode();
  startTimerInterval();
}

function openFocusMode() {
  focusModeDOM.hidden = false;
  document.body.style.overflow = "hidden";

  updateStudyStatus();
  updateFocusMode();
}

function closeFocusMode() {
  focusModeDOM.hidden = true;
  document.body.style.overflow = "";

  updateStudyStatus();
}

function startTimerInterval() {
  clearTimerInterval();

  updateFocusMode();

  timerInterval = window.setInterval(() => {
    updateFocusMode();
  }, 1000);
}

function clearTimerInterval() {
  if (timerInterval !== null) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateFocusMode() {
  if (!studySession) {
    return;
  }

  const sessionSeconds =
    calculateCurrentSessionSeconds();

  const baseTodaySeconds =
    Number(dashboardData?.today_study_seconds) || 0;

  const currentTodaySeconds =
    baseTodaySeconds + sessionSeconds;

  const todayMinutes = Math.floor(
    currentTodaySeconds / 60,
  );

  const currentGrade =
    getGradeByMinutes(todayMinutes);

  const goalRate = Math.min(
    100,
    Math.floor(
      (todayMinutes / DAILY_GOAL_MINUTES) * 100,
    ),
  );

  const nextGrade =
    getNextGradeInformation(todayMinutes);

  focusSubjectNameDOM.textContent =
    studySession.subject_name ||
    selectedSubjectName ||
    "공부";

  focusTimerDOM.textContent =
    formatSeconds(sessionSeconds);

  focusTodayTotalDOM.textContent =
    formatSeconds(currentTodaySeconds);

  focusGradeDOM.textContent =
    `${currentGrade}등급`;

  focusGoalRateDOM.textContent =
    `${goalRate}%`;

  focusGradeProgressDOM.textContent =
    nextGrade.text;

  todayStudyTimeDOM.textContent =
    formatSeconds(currentTodaySeconds);

  renderGoal(todayMinutes);
  renderGrade(todayMinutes);
  updateStudyStatus();

  const isPaused =
    studySession.status === "paused";

  pauseStudyButton.textContent = isPaused
    ? "공부 계속하기"
    : "일시정지";

  focusStatusBadgeDOM.textContent = isPaused
    ? "일시정지"
    : "공부 중";
}

function updateStudyStatus() {
  if (!studySession) {
    studyStatusBadgeDOM.className =
      "badge badge-idle";

    studyStatusBadgeDOM.textContent =
      "공부 대기 중";

    return;
  }

  if (studySession.status === "paused") {
    studyStatusBadgeDOM.className =
      "badge badge-paused";

    studyStatusBadgeDOM.textContent =
      "일시정지";

    return;
  }

  studyStatusBadgeDOM.className =
    "badge badge-running";

  studyStatusBadgeDOM.textContent =
    "공부 중";
}

// =========================================================
// 과목 편집 모달
// =========================================================

function openSubjectEditor() {
  hideMessage(subjectEditorMessageDOM);

  subjectEditorModalDOM.hidden = false;
  document.body.style.overflow = "hidden";

  renderSubjectEditorList();

  window.setTimeout(() => {
    newSubjectInputDOM.focus();
  }, 50);
}

function closeSubjectEditor() {
  subjectEditorModalDOM.hidden = true;

  if (focusModeDOM.hidden) {
    document.body.style.overflow = "";
  }

  newSubjectInputDOM.value = "";
  hideMessage(subjectEditorMessageDOM);
}

function renderSubjectEditorList() {
  subjectEditorListDOM.innerHTML = "";

  if (subjects.length === 0) {
    subjectEditorListDOM.innerHTML = `
      <p class="empty-message">
        등록된 과목이 없습니다.
      </p>
    `;

    return;
  }

  subjects.forEach((subject) => {
    const item = document.createElement("div");
    item.className = "subject-editor-item";

    item.innerHTML = `
      <strong>${escapeHTML(subject.name)}</strong>

      <button
        class="subject-editor-delete"
        type="button"
      >
        삭제
      </button>
    `;

    const deleteButton = item.querySelector(
      ".subject-editor-delete",
    );

    deleteButton.addEventListener("click", () => {
      deleteSubject(subject);
    });

    subjectEditorListDOM.appendChild(item);
  });
}

async function addSubject(event) {
  event.preventDefault();

  const subjectName =
    newSubjectInputDOM.value.trim();

  if (!subjectName) {
    showMessage(
      subjectEditorMessageDOM,
      "과목 이름을 입력해 주세요.",
    );

    return;
  }

  if (
    subjects.some(
      (subject) =>
        subject.name.toLowerCase() ===
        subjectName.toLowerCase(),
    )
  ) {
    showMessage(
      subjectEditorMessageDOM,
      "이미 등록된 과목입니다.",
    );

    return;
  }

  hideMessage(subjectEditorMessageDOM);

  try {
    const result = await apiRequest("/api/subjects", {
      method: "POST",
      body: {
        name: subjectName,
      },
    });

    const newSubject =
      result.subject || result;

    subjects.push(newSubject);

    newSubjectInputDOM.value = "";

    renderSubjects();

    showMessage(
      subjectEditorMessageDOM,
      "과목이 추가되었습니다.",
      "success",
    );

    newSubjectInputDOM.focus();
  } catch (error) {
    showMessage(
      subjectEditorMessageDOM,
      error.message,
    );
  }
}

async function deleteSubject(subject) {
  const confirmed = confirm(
    `"${subject.name}" 과목을 삭제하시겠습니까?`,
  );

  if (!confirmed) {
    return;
  }

  try {
    await apiRequest(`/api/subjects/${subject.id}`, {
      method: "DELETE",
    });

    subjects = subjects.filter(
      (item) =>
        String(item.id) !== String(subject.id),
    );

    if (
      String(selectedSubjectId) ===
      String(subject.id)
    ) {
      selectedSubjectId = null;
      selectedSubjectName = "";
      timerSubjectDOM.value = "";
    }

    renderSubjects();

    showMessage(
      subjectEditorMessageDOM,
      "과목이 삭제되었습니다.",
      "success",
    );
  } catch (error) {
    showMessage(
      subjectEditorMessageDOM,
      error.message,
    );
  }
}

// =========================================================
// 로그아웃
// =========================================================

async function logout() {
  try {
    await apiRequest("/api/logout", {
      method: "POST",
    });
  } catch (error) {
    console.error(error);
  } finally {
    location.href = "/login";
  }
}

// =========================================================
// 이벤트
// =========================================================

startStudyButton.addEventListener(
  "click",
  startStudy,
);

pauseStudyButton.addEventListener(
  "click",
  togglePauseStudy,
);

stopStudyButton.addEventListener(
  "click",
  stopStudy,
);

openSubjectEditorButton.addEventListener(
  "click",
  openSubjectEditor,
);

closeSubjectEditorButton.addEventListener(
  "click",
  closeSubjectEditor,
);

finishSubjectEditorButton.addEventListener(
  "click",
  closeSubjectEditor,
);

subjectEditorBackdropDOM.addEventListener(
  "click",
  closeSubjectEditor,
);

subjectAddForm.addEventListener(
  "submit",
  addSubject,
);

logoutButton?.addEventListener(
  "click",
  logout,
);

mobileLogoutButton?.addEventListener(
  "click",
  logout,
);

document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    !subjectEditorModalDOM.hidden
  ) {
    closeSubjectEditor();
  }
});

window.addEventListener(
    "pagehide",
    () => {
        pauseSessionBeforeLeave();
    }
);

// =========================================================
// 실행
// =========================================================

loadDashboard();