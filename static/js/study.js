"use strict";

document.addEventListener("DOMContentLoaded", () => {
  // =========================================================
  // 1. 서버에서 전달받은 데이터
  // =========================================================

  const pageData = window.STUDY_PAGE_DATA || {};

  // =========================================================
  // 2. 대시보드 DOM
  // =========================================================

  const dashboardView = document.getElementById("dashboardView");
  const mainTopbar = document.getElementById("mainTopbar");

  const todayStudyTime = document.getElementById("todayStudyTime");
  const timerStatusBadge = document.getElementById("timerStatusBadge");

  const goalPercentage = document.getElementById("goalPercentage");
  const goalProgressFill = document.getElementById("goalProgressFill");

  const timerSubject = document.getElementById("timerSubject");
  const subjectList = document.getElementById("subjectList");
  const selectedSubjectText = document.getElementById(
    "selectedSubjectText",
  );
  const subjectSelectorStatus = document.getElementById(
    "subjectSelectorStatus",
  );

  const startStudyButton = document.getElementById(
    "startStudyButton",
  );
  const stopStudyButton = document.getElementById(
    "stopStudyButton",
  );

  const timerMessage = document.getElementById("timerMessage");

  // =========================================================
  // 3. 오늘 등급 DOM
  // =========================================================

  const todayGrade = document.getElementById("todayGrade");
  const todayGradeNumber = document.getElementById(
    "todayGradeNumber",
  );
  const todayGradeBadge = document.getElementById(
    "todayGradeBadge",
  );
  const todayGradePoint = document.getElementById(
    "todayGradePoint",
  );
  const nextGradeText = document.getElementById("nextGradeText");

  const gradeLevelElements = document.querySelectorAll(
    "[data-grade-level]",
  );

  // =========================================================
  // 4. 집중 모드 DOM
  // =========================================================

  const focusMode = document.getElementById("focusMode");
  const focusSubject = document.getElementById("focusSubject");
  const focusTimer = document.getElementById("focusTimer");

  const focusTodayTime = document.getElementById(
    "focusTodayTime",
  );
  const focusGrade = document.getElementById("focusGrade");
  const focusGoalPercentage = document.getElementById(
    "focusGoalPercentage",
  );
  const focusNextGradeText = document.getElementById(
    "focusNextGradeText",
  );
  const focusStatusBadge = document.getElementById(
    "focusStatusBadge",
  );
  const focusInterruptionMessage = document.getElementById(
    "focusInterruptionMessage",
  );

  const resumeFocusButton = document.getElementById(
    "resumeFocusButton",
  );
  const focusStopButton = document.getElementById(
    "focusStopButton",
  );

  // =========================================================
  // 5. 과목 관리 모달 DOM
  // =========================================================

  const openSubjectEditorButton = document.getElementById(
    "openSubjectEditorButton",
  );
  const subjectEditorModal = document.getElementById(
    "subjectEditorModal",
  );
  const closeSubjectEditorButton = document.getElementById(
    "closeSubjectEditorButton",
  );

  const addSubjectForm = document.getElementById(
    "addSubjectForm",
  );
  const newSubjectInput = document.getElementById(
    "newSubjectInput",
  );
  const subjectEditorList = document.getElementById(
    "subjectEditorList",
  );
  const subjectEditorMessage = document.getElementById(
    "subjectEditorMessage",
  );

  const resetSubjectsButton = document.getElementById(
    "resetSubjectsButton",
  );
  const saveSubjectsButton = document.getElementById(
    "saveSubjectsButton",
  );

  // =========================================================
  // 6. 기본 설정
  // =========================================================

  const DEFAULT_SUBJECTS = [
    "국어",
    "수학",
    "영어",
    "물리",
    "화학",
    "생명과학",
    "지구과학",
    "사회",
    "한국사",
    "정보",
    "기타",
  ];

  const SUBJECT_STORAGE_KEY = "studySubjects";

  const baseTodaySeconds = Math.max(
    0,
    Number(
      todayStudyTime?.dataset.seconds ??
        pageData.todaySeconds ??
        0,
    ) || 0,
  );

  const goalSeconds = Math.max(
    1,
    Number(pageData.goalSeconds || 28800),
  );

  // =========================================================
  // 7. 타이머 상태
  // =========================================================

  let subjects = loadSubjects();
  let editingSubjects = [...subjects];

  let selectedSubject = "";
  let sessionSeconds = 0;
  let startedAt = null;

  let timerState = "idle";
  let timerInterval = null;
  let previousTickTime = null;

  // =========================================================
  // 8. 공통 함수
  // =========================================================

  function formatTime(seconds) {
    const safeSeconds = Math.max(
      0,
      Math.floor(Number(seconds) || 0),
    );

    const hours = String(
      Math.floor(safeSeconds / 3600),
    ).padStart(2, "0");

    const minutes = String(
      Math.floor((safeSeconds % 3600) / 60),
    ).padStart(2, "0");

    const secs = String(safeSeconds % 60).padStart(2, "0");

    return `${hours}:${minutes}:${secs}`;
  }

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

  function hideMessage(element) {
    if (!element) {
      return;
    }

    element.textContent = "";
    element.className = "form-message";
    element.hidden = true;
  }

  function getSubjectIcon(subject) {
    return String(subject || "").trim().charAt(0) || "?";
  }

  function updateGradeClass(element, grade) {
    if (!element) {
      return;
    }

    element.classList.remove(
      "grade-1",
      "grade-2",
      "grade-3",
      "grade-4",
      "grade-5",
    );

    element.classList.add(`grade-${grade}`);
  }

  // =========================================================
  // 9. 서버 요청
  // =========================================================

  async function readJsonResponse(response) {
    const contentType =
      response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      const responseText = await response.text();

      console.error(
        "JSON이 아닌 서버 응답:",
        response.status,
        responseText,
      );

      throw new Error(
        `서버 응답 형식이 올바르지 않습니다. (${response.status})`,
      );
    }

    return response.json();
  }

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

    if (response.status === 401) {
      window.location.href = result.redirect || "/login";
      throw new Error("로그인이 필요합니다.");
    }

    if (!response.ok || result.success === false) {
      throw new Error(
        result.message || "요청 처리에 실패했습니다.",
      );
    }

    return result;
  }

  // =========================================================
  // 10. 과목 저장
  // =========================================================

  function loadSubjects() {
    try {
      const savedValue = localStorage.getItem(
        SUBJECT_STORAGE_KEY,
      );

      if (!savedValue) {
        return [...DEFAULT_SUBJECTS];
      }

      const savedSubjects = JSON.parse(savedValue);

      if (!Array.isArray(savedSubjects)) {
        return [...DEFAULT_SUBJECTS];
      }

      const validSubjects = savedSubjects
        .filter((subject) => typeof subject === "string")
        .map((subject) => subject.trim())
        .filter(Boolean);

      return validSubjects.length > 0
        ? validSubjects
        : [...DEFAULT_SUBJECTS];
    } catch (error) {
      console.error("과목 목록 불러오기 오류:", error);

      return [...DEFAULT_SUBJECTS];
    }
  }

  function saveSubjects() {
    localStorage.setItem(
      SUBJECT_STORAGE_KEY,
      JSON.stringify(subjects),
    );
  }

  // =========================================================
  // 11. 과목 선택
  // =========================================================

  function selectSubject(subject) {
    if (
      timerState === "running" ||
      timerState === "paused" ||
      timerState === "saving"
    ) {
      return;
    }

    selectedSubject = String(subject || "").trim();

    if (!selectedSubject) {
      return;
    }

    if (timerSubject) {
      timerSubject.value = selectedSubject;
    }

    if (selectedSubjectText) {
      selectedSubjectText.textContent =
        `${selectedSubject} 선택됨`;
    }

    if (subjectSelectorStatus) {
      subjectSelectorStatus.textContent = "선택 완료";
      subjectSelectorStatus.classList.add("selected");
    }

    renderSubjectButtons();
    updateTimerState("idle");
    hideMessage(timerMessage);
  }

  function renderSubjectButtons() {
    if (!subjectList) {
      return;
    }

    subjectList.innerHTML = "";

    if (subjects.length === 0) {
      subjectList.innerHTML = `
        <p class="empty-message">
          등록된 과목이 없습니다.
        </p>
      `;

      return;
    }

    subjects.forEach((subject) => {
      const button = document.createElement("button");

      button.type = "button";
      button.className = "subject-choice-button";
      button.dataset.subject = subject;

      const isSelected = subject === selectedSubject;

      button.classList.toggle("active", isSelected);
      button.classList.toggle("selected", isSelected);

      button.setAttribute(
        "aria-pressed",
        String(isSelected),
      );

      const icon = document.createElement("span");
      icon.className = "subject-choice-icon";
      icon.textContent = getSubjectIcon(subject);

      const name = document.createElement("span");
      name.className = "subject-choice-name";
      name.textContent = subject;

      button.append(icon, name);

      button.addEventListener("click", () => {
        selectSubject(subject);
      });

      subjectList.appendChild(button);
    });
  }

    // =========================================================
  // 12. 과목 관리 모달
  // =========================================================

  function openSubjectEditor() {
    if (
      timerState === "running" ||
      timerState === "paused" ||
      timerState === "saving"
    ) {
      showMessage(
        timerMessage,
        "공부 중에는 과목을 수정할 수 없습니다.",
      );

      return;
    }

    editingSubjects = [...subjects];

    renderSubjectEditorList();
    hideMessage(subjectEditorMessage);

    if (subjectEditorModal) {
      subjectEditorModal.hidden = false;
    }

    document.body.style.overflow = "hidden";

    window.setTimeout(() => {
      newSubjectInput?.focus();
    }, 50);
  }

  function closeSubjectEditor() {
    if (subjectEditorModal) {
      subjectEditorModal.hidden = true;
    }

    document.body.style.overflow = "";
    hideMessage(subjectEditorMessage);
  }

  function renderSubjectEditorList() {
    if (!subjectEditorList) {
      return;
    }

    subjectEditorList.innerHTML = "";

    if (editingSubjects.length === 0) {
      subjectEditorList.innerHTML = `
        <p class="empty-message">
          등록된 과목이 없습니다.
        </p>
      `;

      return;
    }

    editingSubjects.forEach((subject, index) => {
      const item = document.createElement("div");
      item.className = "subject-editor-item";

      const nameArea = document.createElement("div");
      nameArea.className = "subject-editor-item-name";

      const icon = document.createElement("span");
      icon.className = "subject-editor-item-icon";
      icon.textContent = getSubjectIcon(subject);

      const name = document.createElement("span");
      name.textContent = subject;

      nameArea.append(icon, name);

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "subject-delete-button";
      deleteButton.textContent = "삭제";

      deleteButton.addEventListener("click", () => {
        if (editingSubjects.length <= 1) {
          showMessage(
            subjectEditorMessage,
            "과목은 최소 1개 이상 있어야 합니다.",
          );

          return;
        }

        editingSubjects.splice(index, 1);

        hideMessage(subjectEditorMessage);
        renderSubjectEditorList();
      });

      item.append(nameArea, deleteButton);
      subjectEditorList.appendChild(item);
    });
  }

  function addNewSubject() {
    const subject = newSubjectInput?.value.trim() || "";

    if (!subject) {
      showMessage(
        subjectEditorMessage,
        "추가할 과목 이름을 입력해 주세요.",
      );

      newSubjectInput?.focus();
      return;
    }

    if (subject.length > 10) {
      showMessage(
        subjectEditorMessage,
        "과목 이름은 10자 이하로 입력해 주세요.",
      );

      newSubjectInput?.focus();
      return;
    }

    const duplicated = editingSubjects.some(
      (item) =>
        item.toLowerCase() === subject.toLowerCase(),
    );

    if (duplicated) {
      showMessage(
        subjectEditorMessage,
        "이미 등록된 과목입니다.",
      );

      newSubjectInput?.focus();
      return;
    }

    editingSubjects.push(subject);

    if (newSubjectInput) {
      newSubjectInput.value = "";
    }

    hideMessage(subjectEditorMessage);
    renderSubjectEditorList();

    newSubjectInput?.focus();
  }

  function applySubjectChanges() {
    if (editingSubjects.length === 0) {
      showMessage(
        subjectEditorMessage,
        "과목은 최소 1개 이상 있어야 합니다.",
      );

      return;
    }

    subjects = [...editingSubjects];
    saveSubjects();

    if (
      selectedSubject &&
      !subjects.includes(selectedSubject)
    ) {
      selectedSubject = "";

      if (timerSubject) {
        timerSubject.value = "";
      }

      if (selectedSubjectText) {
        selectedSubjectText.textContent =
          "과목을 선택해 주세요";
      }

      if (subjectSelectorStatus) {
        subjectSelectorStatus.textContent = "미선택";
        subjectSelectorStatus.classList.remove("selected");
      }
    }

    renderSubjectButtons();
    updateTimerState("idle");
    closeSubjectEditor();
  }

  // =========================================================
  // 13. 공부 등급 계산
  // =========================================================

  function calculateGrade(totalSeconds) {
    if (totalSeconds >= 10 * 3600) {
      return {
        grade: 1,
        point: 5,
        nextGrade: null,
        remainingSeconds: 0,
      };
    }

    if (totalSeconds >= 7 * 3600) {
      return {
        grade: 2,
        point: 4,
        nextGrade: 1,
        remainingSeconds:
          10 * 3600 - totalSeconds,
      };
    }

    if (totalSeconds >= 4 * 3600) {
      return {
        grade: 3,
        point: 3,
        nextGrade: 2,
        remainingSeconds:
          7 * 3600 - totalSeconds,
      };
    }

    if (totalSeconds >= 2 * 3600) {
      return {
        grade: 4,
        point: 2,
        nextGrade: 3,
        remainingSeconds:
          4 * 3600 - totalSeconds,
      };
    }

    return {
      grade: 5,
      point: 1,
      nextGrade: 4,
      remainingSeconds:
        2 * 3600 - totalSeconds,
    };
  }

  function getGradeMessage(gradeInfo) {
    if (gradeInfo.grade === 1) {
      return "오늘 최고 등급을 달성했습니다.";
    }

    return (
      `${gradeInfo.nextGrade}등급까지 ` +
      `${formatTime(gradeInfo.remainingSeconds)} 남았습니다.`
    );
  }

  // =========================================================
  // 14. 화면 갱신
  // =========================================================

  function updateTimerDisplay() {
    const totalSeconds =
      baseTodaySeconds + sessionSeconds;

    const percentage = Math.min(
      100,
      Math.round(
        (totalSeconds / goalSeconds) * 100,
      ),
    );

    const gradeInfo =
      calculateGrade(totalSeconds);

    const gradeMessage =
      getGradeMessage(gradeInfo);

    if (todayStudyTime) {
      todayStudyTime.textContent =
        formatTime(totalSeconds);
    }

    if (goalPercentage) {
      goalPercentage.textContent = `${percentage}%`;
    }

    if (goalProgressFill) {
      goalProgressFill.style.width = `${percentage}%`;
    }

    if (todayGrade) {
      todayGrade.textContent =
        String(gradeInfo.grade);
    }

    if (todayGradeNumber) {
      todayGradeNumber.textContent =
        String(gradeInfo.grade);
    }

    if (todayGradeBadge) {
      updateGradeClass(
        todayGradeBadge,
        gradeInfo.grade,
      );
    }

    if (todayGradePoint) {
      todayGradePoint.textContent =
        `${gradeInfo.point}점`;
    }

    if (nextGradeText) {
      nextGradeText.textContent = gradeMessage;
    }

    gradeLevelElements.forEach((element) => {
      const elementGrade = Number(
        element.dataset.gradeLevel,
      );

      element.classList.toggle(
        "active",
        elementGrade === gradeInfo.grade,
      );
    });

    if (focusTimer) {
      focusTimer.textContent =
        formatTime(sessionSeconds);
    }

    if (focusTodayTime) {
      focusTodayTime.textContent =
        formatTime(totalSeconds);
    }

    if (focusGrade) {
      focusGrade.textContent =
        `${gradeInfo.grade}등급`;

      updateGradeClass(
        focusGrade,
        gradeInfo.grade,
      );
    }

    if (focusGoalPercentage) {
      focusGoalPercentage.textContent =
        `${percentage}%`;
    }

    if (focusNextGradeText) {
      focusNextGradeText.textContent =
        gradeMessage;
    }

    if (timerState === "running") {
      document.title =
        `${formatTime(sessionSeconds)} · ${selectedSubject}`;
    } else {
      document.title =
        "혜윰X세콜 <돼지런한 여름방학>";
    }
  }

  // =========================================================
  // 15. 타이머 상태 갱신
  // =========================================================

  function updateTimerState(nextState, message = "") {
    timerState = nextState;

    if (timerStatusBadge) {
      timerStatusBadge.className = "badge";
    }

    if (nextState === "running") {
      if (timerStatusBadge) {
        timerStatusBadge.textContent = "공부 중";
        timerStatusBadge.classList.add(
          "badge-success",
        );
      }

      if (focusStatusBadge) {
        focusStatusBadge.textContent = "집중 중";
        focusStatusBadge.classList.remove("paused");
      }

      if (startStudyButton) {
        startStudyButton.disabled = true;
        startStudyButton.textContent = "공부 진행 중";
      }

      if (stopStudyButton) {
        stopStudyButton.disabled = false;
        stopStudyButton.textContent = "공부 종료";
      }

      if (focusStopButton) {
        focusStopButton.disabled = false;
        focusStopButton.textContent = "공부 종료";
      }

      if (resumeFocusButton) {
        resumeFocusButton.hidden = true;
        resumeFocusButton.disabled = false;
      }

      if (focusInterruptionMessage) {
        focusInterruptionMessage.hidden = true;
      }

      hideMessage(timerMessage);
      return;
    }

    if (nextState === "paused") {
      if (timerStatusBadge) {
        timerStatusBadge.textContent = "일시정지";
        timerStatusBadge.classList.add(
          "badge-warning",
        );
      }

      if (focusStatusBadge) {
        focusStatusBadge.textContent = "일시정지";
        focusStatusBadge.classList.add("paused");
      }

      if (startStudyButton) {
        startStudyButton.disabled = false;
        startStudyButton.textContent =
          "공부 계속하기";
      }

      if (stopStudyButton) {
        stopStudyButton.disabled = false;
      }

      if (resumeFocusButton) {
        resumeFocusButton.hidden = false;
        resumeFocusButton.disabled = false;
      }

      if (focusInterruptionMessage) {
        focusInterruptionMessage.textContent =
          message ||
          "집중이 일시정지되었습니다.";

        focusInterruptionMessage.hidden = false;
      }

      showMessage(
        timerMessage,
        message || "공부가 일시정지되었습니다.",
      );

      return;
    }

    if (nextState === "saving") {
      if (startStudyButton) {
        startStudyButton.disabled = true;
      }

      if (stopStudyButton) {
        stopStudyButton.disabled = true;
        stopStudyButton.textContent = "저장 중...";
      }

      if (focusStopButton) {
        focusStopButton.disabled = true;
        focusStopButton.textContent = "저장 중...";
      }

      if (resumeFocusButton) {
        resumeFocusButton.disabled = true;
      }

      return;
    }

    // idle 상태
    if (timerStatusBadge) {
      timerStatusBadge.textContent = "대기 중";
      timerStatusBadge.classList.add("badge-idle");
    }

    const subject =
      selectedSubject ||
      timerSubject?.value.trim() ||
      "";

    if (startStudyButton) {
      startStudyButton.disabled = !subject;

      startStudyButton.textContent = subject
        ? `${subject} 공부 시작`
        : "과목을 선택해 주세요";
    }

    if (stopStudyButton) {
      stopStudyButton.disabled = true;
      stopStudyButton.textContent = "공부 종료";
    }

    if (focusStopButton) {
      focusStopButton.disabled = false;
      focusStopButton.textContent = "공부 종료";
    }

    if (resumeFocusButton) {
      resumeFocusButton.hidden = true;
      resumeFocusButton.disabled = false;
    }

    hideMessage(timerMessage);
  }

    // =========================================================
  // 16. 집중 모드
  // =========================================================

  function enterFocusMode(subject) {
    selectedSubject = subject;

    if (focusSubject) {
      focusSubject.textContent = subject;
    }

    if (dashboardView) {
      dashboardView.hidden = true;
    }

    if (mainTopbar) {
      mainTopbar.hidden = true;
    }

    if (focusMode) {
      focusMode.hidden = false;
    }

    document.body.classList.add("focus-active");

    window.scrollTo({
      top: 0,
      behavior: "instant",
    });
  }

  function exitFocusMode() {
    if (dashboardView) {
      dashboardView.hidden = false;
    }

    if (mainTopbar) {
      mainTopbar.hidden = false;
    }

    if (focusMode) {
      focusMode.hidden = true;
    }

    document.body.classList.remove("focus-active");
  }

  // =========================================================
  // 17. 실제 타이머
  // =========================================================

  function updateElapsedTime() {
    if (
      timerState !== "running" ||
      previousTickTime === null
    ) {
      return;
    }

    const currentTime = Date.now();

    const elapsedMilliseconds =
      currentTime - previousTickTime;

    if (elapsedMilliseconds < 1000) {
      return;
    }

    const elapsedSeconds = Math.floor(
      elapsedMilliseconds / 1000,
    );

    sessionSeconds += elapsedSeconds;
    previousTickTime += elapsedSeconds * 1000;

    updateTimerDisplay();
  }

  function startTicking() {
    previousTickTime = Date.now();

    if (timerInterval !== null) {
      clearInterval(timerInterval);
    }

    timerInterval = window.setInterval(
      updateElapsedTime,
      250,
    );

    updateTimerState("running");
    updateTimerDisplay();
  }

  function stopTicking() {
    if (timerState === "running") {
      updateElapsedTime();
    }

    if (timerInterval !== null) {
      clearInterval(timerInterval);
    }

    timerInterval = null;
    previousTickTime = null;
  }

  function startTimer() {
    if (
      timerState === "running" ||
      timerState === "saving"
    ) {
      return;
    }

    if (timerState === "paused") {
      resumeTimer();
      return;
    }

    const subject =
      selectedSubject ||
      timerSubject?.value.trim() ||
      "";

    if (!subject) {
      showMessage(
        timerMessage,
        "공부할 과목을 선택해 주세요.",
      );

      return;
    }

    sessionSeconds = 0;
    startedAt = new Date().toISOString();
    selectedSubject = subject;

    enterFocusMode(subject);
    startTicking();
  }

  function pauseTimer(message) {
    if (timerState !== "running") {
      return;
    }

    stopTicking();

    updateTimerState(
      "paused",
      message ||
        "화면을 벗어나 공부가 일시정지되었습니다.",
    );

    updateTimerDisplay();
  }

  function resumeTimer() {
    if (timerState !== "paused") {
      return;
    }

    startTicking();
  }

  function resetTimer() {
    stopTicking();

    sessionSeconds = 0;
    startedAt = null;
    selectedSubject = "";

    if (timerSubject) {
      timerSubject.value = "";
    }

    if (selectedSubjectText) {
      selectedSubjectText.textContent =
        "과목을 선택해 주세요";
    }

    if (subjectSelectorStatus) {
      subjectSelectorStatus.textContent = "미선택";
      subjectSelectorStatus.classList.remove("selected");
    }

    exitFocusMode();
    renderSubjectButtons();
    updateTimerState("idle");
    updateTimerDisplay();
  }

  // =========================================================
  // 18. 공부 기록 저장
  // =========================================================

  async function saveTimerRecord() {
    if (
      timerState !== "running" &&
      timerState !== "paused"
    ) {
      return;
    }

    const wasRunning = timerState === "running";

    if (wasRunning) {
      stopTicking();
    }

    if (sessionSeconds < 10) {
      window.alert(
        "10초 이상 공부한 뒤 종료해 주세요.",
      );

      if (wasRunning) {
        startTicking();
      }

      return;
    }

    const subject =
      selectedSubject ||
      timerSubject?.value.trim() ||
      "";

    if (!subject) {
      window.alert(
        "공부한 과목 정보가 없습니다.",
      );

      if (wasRunning) {
        startTicking();
      }

      return;
    }

    const confirmed = window.confirm(
      `${subject} 공부 기록 ${formatTime(sessionSeconds)}을 저장할까요?`,
    );

    if (!confirmed) {
      if (wasRunning) {
        startTicking();
      } else {
        updateTimerState("paused");
      }

      return;
    }

    updateTimerState("saving");

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
      console.error(
        "공부 기록 저장 오류:",
        error,
      );

      window.alert(
        error.message ||
          "공부 기록 저장 중 오류가 발생했습니다.",
      );

      updateTimerState(
        "paused",
        "저장에 실패했습니다. 다시 시도해 주세요.",
      );
    }
  }

  // =========================================================
  // 19. 공부 기록 삭제
  // =========================================================

  async function deleteStudyRecord(button) {
    const recordId =
      button.dataset.recordId ||
      button.dataset.deleteRecord;

    if (!recordId) {
      console.error(
        "삭제할 공부 기록 ID가 없습니다.",
      );

      return;
    }

    const confirmed = window.confirm(
      "이 공부 기록을 삭제할까요?",
    );

    if (!confirmed) {
      return;
    }

    const originalText = button.textContent;

    button.disabled = true;
    button.textContent = "삭제 중";

    try {
      await requestJson(
        `/api/study-records/${recordId}`,
        {
          method: "DELETE",
        },
      );

      button.closest(".record-item")?.remove();

      window.location.reload();
    } catch (error) {
      console.error(
        "공부 기록 삭제 오류:",
        error,
      );

      window.alert(
        error.message ||
          "공부 기록 삭제 중 오류가 발생했습니다.",
      );

      button.disabled = false;
      button.textContent = originalText;
    }
  }

  // =========================================================
  // 20. 이벤트 연결
  // =========================================================

  openSubjectEditorButton?.addEventListener(
    "click",
    openSubjectEditor,
  );

  closeSubjectEditorButton?.addEventListener(
    "click",
    closeSubjectEditor,
  );

  document
    .querySelectorAll("[data-close-subject-editor]")
    .forEach((element) => {
      element.addEventListener(
        "click",
        closeSubjectEditor,
      );
    });

  addSubjectForm?.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      addNewSubject();
    },
  );

  saveSubjectsButton?.addEventListener(
    "click",
    applySubjectChanges,
  );

  resetSubjectsButton?.addEventListener(
    "click",
    () => {
      const confirmed = window.confirm(
        "과목 목록을 기본값으로 초기화할까요?",
      );

      if (!confirmed) {
        return;
      }

      editingSubjects = [...DEFAULT_SUBJECTS];

      hideMessage(subjectEditorMessage);
      renderSubjectEditorList();
    },
  );

  startStudyButton?.addEventListener(
    "click",
    startTimer,
  );

  stopStudyButton?.addEventListener(
    "click",
    saveTimerRecord,
  );

  focusStopButton?.addEventListener(
    "click",
    saveTimerRecord,
  );

  resumeFocusButton?.addEventListener(
    "click",
    resumeTimer,
  );

  document
    .querySelectorAll(
      ".record-delete-button, [data-delete-record]",
    )
    .forEach((button) => {
      button.addEventListener("click", () => {
        deleteStudyRecord(button);
      });
    });

  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Escape" &&
        subjectEditorModal &&
        !subjectEditorModal.hidden
      ) {
        closeSubjectEditor();
      }
    },
  );

  // =========================================================
  // 21. 화면 이탈 감지
  // =========================================================

  document.addEventListener(
    "visibilitychange",
    () => {
      if (
        document.hidden &&
        timerState === "running"
      ) {
        pauseTimer(
          "다른 탭으로 이동하여 공부가 일시정지되었습니다. 다시 시작 버튼을 눌러 주세요.",
        );
      }
    },
  );

  window.addEventListener("blur", () => {
    if (timerState === "running") {
      pauseTimer(
        "브라우저 화면을 벗어나 공부가 일시정지되었습니다. 다시 시작 버튼을 눌러 주세요.",
      );
    }
  });

  window.addEventListener(
    "beforeunload",
    (event) => {
      if (
        timerState === "running" ||
        timerState === "paused" ||
        timerState === "saving"
      ) {
        event.preventDefault();
        event.returnValue = "";
      }
    },
  );

  // =========================================================
  // 22. 초기 실행
  // =========================================================

  if (focusMode) {
    focusMode.hidden = true;
  }

  renderSubjectButtons();
  updateTimerDisplay();
  updateTimerState("idle");

  console.log("study.js 정상 로드 완료");
});