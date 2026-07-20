document.addEventListener("DOMContentLoaded", () => {
  const pageData = window.STUDY_PAGE_DATA || {};

  // =========================================================
  // 기본 대시보드 요소
  // =========================================================
  const dashboardView = document.getElementById("dashboardView");
  const mainTopbar = document.getElementById("mainTopbar");
  const todayStudyTime = document.getElementById("todayStudyTime");
  const timerStatusBadge = document.getElementById("timerStatusBadge");
  const goalPercentage = document.getElementById("goalPercentage");
  const goalProgressFill = document.getElementById("goalProgressFill");
  const timerSubject = document.getElementById("timerSubject");
  const subjectList = document.getElementById("subjectList");
  const selectedSubjectText = document.getElementById("selectedSubjectText");
  const openSubjectEditorButton = document.getElementById(
    "openSubjectEditorButton",
  );
  const subjectEditorModal = document.getElementById("subjectEditorModal");
  const closeSubjectEditorButton = document.getElementById(
    "closeSubjectEditorButton",
  );
  const addSubjectForm = document.getElementById("addSubjectForm");
  const newSubjectInput = document.getElementById("newSubjectInput");
  const subjectEditorList = document.getElementById("subjectEditorList");
  const subjectEditorMessage = document.getElementById("subjectEditorMessage");
  const resetSubjectsButton = document.getElementById("resetSubjectsButton");
  const saveSubjectsButton = document.getElementById("saveSubjectsButton");
  const gradeLevelElements = document.querySelectorAll("[data-grade-level]");
  const startStudyButton = document.getElementById("startStudyButton");
  const selectedSubjectText = document.getElementById("selectedSubjectText");
  const subjectSelectorStatus = document.getElementById(
    "subjectSelectorStatus",
  );
  const todayGradeNumber = document.getElementById("todayGradeNumber");
  const gradeLevelElements = document.querySelectorAll("[data-grade-level]");
  const startStudyButton = document.getElementById("startStudyButton");
  const stopStudyButton = document.getElementById("stopStudyButton");
  const timerMessage = document.getElementById("timerMessage");

  // =========================================================
  // 오늘 등급 요소
  // =========================================================
  const todayGrade = document.getElementById("todayGrade");
  const todayGradeBadge = document.getElementById("todayGradeBadge");
  const todayGradePoint = document.getElementById("todayGradePoint");
  const nextGradeText = document.getElementById("nextGradeText");

  // =========================================================
  // 집중 모드 요소
  // =========================================================
  const focusMode = document.getElementById("focusMode");
  const focusSubject = document.getElementById("focusSubject");
  const focusTimer = document.getElementById("focusTimer");

  const focusTodayTime = document.getElementById("focusTodayTime");
  const focusGrade = document.getElementById("focusGrade");
  const focusGoalPercentage = document.getElementById("focusGoalPercentage");

  const focusNextGradeText = document.getElementById("focusNextGradeText");

  const focusStatusBadge = document.getElementById("focusStatusBadge");

  const focusInterruptionMessage = document.getElementById(
    "focusInterruptionMessage",
  );

  const resumeFocusButton = document.getElementById("resumeFocusButton");

  const focusStopButton = document.getElementById("focusStopButton");

  // =========================================================
  // 초기 데이터
  // =========================================================
  const baseTodaySeconds = Number(
    todayStudyTime?.dataset.seconds ?? pageData.todaySeconds ?? 0,
  );

  const goalSeconds = Math.max(1, Number(pageData.goalSeconds || 28800));

  let sessionSeconds = 0;

  /*
   * idle    : 공부 시작 전
   * running : 공부 시간 측정 중
   * paused  : 화면 이탈 등으로 일시정지
   * saving  : 서버 저장 중
   */
  let timerState = "idle";

  let startedAt = null;
  let timerInterval = null;
  let previousTickTime = null;
  let selectedSubject = "";

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

  let subjects = loadSubjects();
  let editingSubjects = [...subjects];

  function loadSubjects() {
    try {
      const savedSubjects = JSON.parse(
        localStorage.getItem(SUBJECT_STORAGE_KEY),
      );

      if (Array.isArray(savedSubjects) && savedSubjects.length > 0) {
        return savedSubjects.filter(
          (subject) => typeof subject === "string" && subject.trim(),
        );
      }
    } catch (error) {
      console.error("과목 목록 불러오기 오류:", error);
    }

    return [...DEFAULT_SUBJECTS];
  }

  function saveSubjects() {
    localStorage.setItem(SUBJECT_STORAGE_KEY, JSON.stringify(subjects));
  }

  function getSubjectIcon(subject) {
    return subject.trim().charAt(0) || "?";
  }

  function selectSubject(subject) {
    if (
      timerState === "running" ||
      timerState === "paused" ||
      timerState === "saving"
    ) {
      return;
    }

    selectedSubject = subject;

    if (timerSubject) {
      timerSubject.value = subject;
    }

    if (selectedSubjectText) {
      selectedSubjectText.textContent = `${subject} 선택됨`;
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

    subjects.forEach((subject) => {
      const button = document.createElement("button");

      button.type = "button";
      button.className = "subject-choice-button";

      if (subject === selectedSubject) {
        button.classList.add("active");
      }

      button.setAttribute("aria-pressed", String(subject === selectedSubject));

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

  function openSubjectEditor() {
    if (
      timerState === "running" ||
      timerState === "paused" ||
      timerState === "saving"
    ) {
      showMessage(timerMessage, "공부 중에는 과목을 수정할 수 없습니다.");

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
        renderSubjectEditorList();
      });

      item.append(nameArea, deleteButton);
      subjectEditorList.appendChild(item);
    });
  }

  function addNewSubject() {
    const subject = newSubjectInput?.value.trim() || "";

    if (!subject) {
      showMessage(subjectEditorMessage, "추가할 과목 이름을 입력해 주세요.");

      newSubjectInput?.focus();
      return;
    }

    if (subject.length > 10) {
      showMessage(
        subjectEditorMessage,
        "과목 이름은 10자 이하로 입력해 주세요.",
      );

      return;
    }

    const duplicated = editingSubjects.some(
      (item) => item.toLowerCase() === subject.toLowerCase(),
    );

    if (duplicated) {
      showMessage(subjectEditorMessage, "이미 등록된 과목입니다.");

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
    subjects = [...editingSubjects];
    saveSubjects();

    if (selectedSubject && !subjects.includes(selectedSubject)) {
      selectedSubject = "";

      if (timerSubject) {
        timerSubject.value = "";
      }

      if (selectedSubjectText) {
        selectedSubjectText.textContent = "과목을 선택해 주세요";
      }
    }

    renderSubjectButtons();
    updateTimerState("idle");
    closeSubjectEditor();
  }

  // =========================================================
  // 시간 형식 변환
  // =========================================================
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

  // =========================================================
  // 메시지 표시
  // =========================================================
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

  // =========================================================
  // 서버 응답 처리
  // =========================================================
  async function readJsonResponse(response) {
    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      const text = await response.text();

      console.error("JSON이 아닌 서버 응답:", response.status, text);

      throw new Error(`서버 응답 오류 (${response.status})`);
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

    if (response.status === 401 && result.redirect) {
      window.location.href = result.redirect;

      throw new Error("로그인이 필요합니다.");
    }

    if (!response.ok || result.success === false) {
      throw new Error(result.message || "요청 처리에 실패했습니다.");
    }

    return result;
  }

  // =========================================================
  // 공부 등급 계산
  //
  // 1등급: 10시간 이상
  // 2등급: 7시간 이상
  // 3등급: 4시간 이상
  // 4등급: 2시간 이상
  // 5등급: 2시간 미만
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
        remainingSeconds: 10 * 3600 - totalSeconds,
      };
    }

    if (totalSeconds >= 4 * 3600) {
      return {
        grade: 3,
        point: 3,
        nextGrade: 2,
        remainingSeconds: 7 * 3600 - totalSeconds,
      };
    }

    if (totalSeconds >= 2 * 3600) {
      return {
        grade: 4,
        point: 2,
        nextGrade: 3,
        remainingSeconds: 4 * 3600 - totalSeconds,
      };
    }

    return {
      grade: 5,
      point: 1,
      nextGrade: 4,
      remainingSeconds: 2 * 3600 - totalSeconds,
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
  // 전체 화면 표시 갱신
  // =========================================================
  function updateTimerDisplay() {
    const totalSeconds = baseTodaySeconds + sessionSeconds;

    const percentage =
      goalSeconds > 0
        ? Math.min(100, Math.round((totalSeconds / goalSeconds) * 100))
        : 0;

    const gradeInfo = calculateGrade(totalSeconds);

    const gradeMessage = getGradeMessage(gradeInfo);

    // 대시보드 시간
    if (todayStudyTime) {
      todayStudyTime.textContent = formatTime(totalSeconds);
    }

    // 목표 달성률
    if (goalPercentage) {
      goalPercentage.textContent = `${percentage}%`;
    }

    if (goalProgressFill) {
      goalProgressFill.style.width = `${percentage}%`;
    }

    // 등급 카드
    if (todayGrade) {
      todayGrade.textContent = gradeInfo.grade;
    }

    gradeLevelElements.forEach((element) => {
      const grade = Number(element.dataset.gradeLevel);

      element.classList.toggle("active", grade === gradeInfo.grade);
    });
    if (todayGradeNumber) {
      todayGradeNumber.textContent = gradeInfo.grade;
    }

    gradeLevelElements.forEach((element) => {
      const elementGrade = Number(element.dataset.gradeLevel);

      element.classList.toggle("active", elementGrade === gradeInfo.grade);
    });

    if (todayGradeBadge) {
      updateGradeClass(todayGradeBadge, gradeInfo.grade);
    }

    if (todayGradePoint) {
      todayGradePoint.textContent = `${gradeInfo.point}점`;
    }

    if (nextGradeText) {
      nextGradeText.textContent = gradeMessage;
    }

    // 집중 모드
    if (focusTimer) {
      focusTimer.textContent = formatTime(sessionSeconds);
    }

    if (focusTodayTime) {
      focusTodayTime.textContent = formatTime(totalSeconds);
    }

    if (focusGrade) {
      focusGrade.textContent = `${gradeInfo.grade}등급`;

      updateGradeClass(focusGrade, gradeInfo.grade);
    }

    if (focusGoalPercentage) {
      focusGoalPercentage.textContent = `${percentage}%`;
    }

    if (focusNextGradeText) {
      focusNextGradeText.textContent = gradeMessage;
    }

    if (timerState === "running") {
      document.title = `${formatTime(sessionSeconds)} · ${selectedSubject}`;
    } else {
      document.title = "혜윰X세콜 <돼지런한 여름방학>";
    }
  }

  // =========================================================
  // 타이머 상태 표시
  // =========================================================
  function updateTimerState(nextState, message = "") {
    timerState = nextState;

    if (timerStatusBadge) {
      timerStatusBadge.className = "badge";
    }

    if (nextState === "running") {
      if (timerStatusBadge) {
        timerStatusBadge.textContent = "공부 중";
        timerStatusBadge.classList.add("badge-success");
      }

      if (focusStatusBadge) {
        focusStatusBadge.textContent = "집중 중";
        focusStatusBadge.classList.remove("paused");
      }

      if (startStudyButton) {
        if (startStudyButton) {
          const hasSelectedSubject = Boolean(timerSubject?.value);

          startStudyButton.disabled = !hasSelectedSubject;

          startStudyButton.textContent = hasSelectedSubject
            ? `${timerSubject.value} 공부 시작`
            : "과목을 선택해 주세요";
        }
      }

      if (stopStudyButton) {
        stopStudyButton.disabled = false;
        stopStudyButton.textContent = "공부 종료";
      }

      if (resumeFocusButton) {
        resumeFocusButton.hidden = true;
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
        timerStatusBadge.classList.add("badge-warning");
      }

      if (focusStatusBadge) {
        focusStatusBadge.textContent = "일시정지";

        focusStatusBadge.classList.add("paused");
      }

      if (startStudyButton) {
        startStudyButton.disabled = false;
        startStudyButton.textContent = "공부 계속하기";
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
          message || "화면을 벗어나 타이머가 일시정지되었습니다.";

        focusInterruptionMessage.hidden = false;
      }

      showMessage(
        timerMessage,
        message || "화면을 벗어나 타이머가 일시정지되었습니다.",
        "error",
      );

      return;
    }

    if (nextState === "saving") {
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

    // idle
    if (timerStatusBadge) {
      timerStatusBadge.textContent = "대기 중";
      timerStatusBadge.classList.add("badge-idle");
    }

    if (startStudyButton) {
      const subject = timerSubject?.value.trim() || "";

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
  // 집중 모드 진입
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

  // =========================================================
  // 집중 모드 종료
  // =========================================================
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
  // 실제 경과 시간 계산
  // =========================================================
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

  // =========================================================
  // 타이머 반복 실행
  // =========================================================
  function startTicking() {
    previousTickTime = Date.now();

    if (timerInterval !== null) {
      clearInterval(timerInterval);
    }

    timerInterval = window.setInterval(updateElapsedTime, 250);

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
  function selectSubject(button) {
    if (
      timerState === "running" ||
      timerState === "paused" ||
      timerState === "saving"
    ) {
      return;
    }

    const subject = button.dataset.subject || "";

    if (!subject) {
      return;
    }

    subjectButtons.forEach((item) => {
      item.classList.remove("active");
      item.setAttribute("aria-pressed", "false");
    });

    button.classList.add("active");
    button.setAttribute("aria-pressed", "true");

    if (timerSubject) {
      timerSubject.value = subject;
    }

    if (selectedSubjectText) {
      selectedSubjectText.textContent = subject;
    }

    if (subjectSelectorStatus) {
      subjectSelectorStatus.textContent = "선택 완료";
      subjectSelectorStatus.classList.add("selected");
    }

    if (startStudyButton) {
      startStudyButton.disabled = false;
      startStudyButton.textContent = `${subject} 공부 시작`;
    }

    hideMessage(timerMessage);
  }

  // =========================================================
  // 공부 시작
  // =========================================================
  function startTimer() {
    if (timerState === "running" || timerState === "saving") {
      return;
    }

    const subject = selectedSubject || timerSubject?.value.trim() || "";

    if (!subject) {
      showMessage(timerMessage, "공부할 과목을 선택해 주세요.");

      timerSubject?.focus();

      return;
    }

    if (timerState === "idle") {
      sessionSeconds = 0;
      startedAt = new Date().toISOString();
      selectedSubject = subject;

      enterFocusMode(subject);
    }

    startTicking();
  }

  // =========================================================
  // 타이머 일시정지
  // =========================================================
  function pauseTimer(message) {
    if (timerState !== "running") {
      return;
    }

    stopTicking();

    updateTimerState(
      "paused",
      message || "화면을 벗어나 타이머가 일시정지되었습니다.",
    );

    updateTimerDisplay();
  }

  // =========================================================
  // 집중 다시 시작
  // =========================================================
  function resumeTimer() {
    if (timerState !== "paused") {
      return;
    }

    startTicking();
  }

  // =========================================================
  // 타이머 초기화
  // =========================================================
  function resetTimer() {
    stopTicking();

    sessionSeconds = 0;
    startedAt = null;
    selectedSubject = "";

    selectedSubject = "";

    if (timerSubject) {
      timerSubject.value = "";
    }

    if (selectedSubjectText) {
      selectedSubjectText.textContent = "과목을 선택해 주세요";
    }

    renderSubjectButtons();
    subjectButtons.forEach((button) => {
      button.classList.remove("active");
      button.setAttribute("aria-pressed", "false");
    });

    if (selectedSubjectText) {
      selectedSubjectText.textContent = "과목을 선택해 주세요";
    }

    if (subjectSelectorStatus) {
      subjectSelectorStatus.textContent = "미선택";
      subjectSelectorStatus.classList.remove("selected");
    }
    exitFocusMode();

    updateTimerState("idle");
    updateTimerDisplay();
  }

  // =========================================================
  // 공부 기록 저장
  // =========================================================
  async function saveTimerRecord() {
    if (timerState !== "running" && timerState !== "paused") {
      return;
    }

    const wasRunning = timerState === "running";

    if (wasRunning) {
      stopTicking();
    }

    updateTimerState("paused", "공부가 일시정지되었습니다.");

    if (sessionSeconds < 10) {
      window.alert("10초 이상 공부한 뒤 종료해 주세요.");

      if (wasRunning) {
        startTicking();
      }

      return;
    }

    const subject = selectedSubject || timerSubject?.value.trim() || "";

    if (!subject) {
      window.alert("공부한 과목을 선택해 주세요.");

      return;
    }

    const confirmed = window.confirm(
      `${subject} 공부 기록 ${formatTime(sessionSeconds)}을 저장할까요?`,
    );

    if (!confirmed) {
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
      console.error("공부 기록 저장 오류:", error);

      window.alert(error.message || "공부 기록 저장 중 오류가 발생했습니다.");

      updateTimerState("paused", "저장에 실패했습니다. 다시 시도해 주세요.");
    }
  }

  // =========================================================
  // 공부 기록 삭제
  // =========================================================
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

  // =========================================================
  // 이벤트 등록
  // =========================================================

  openSubjectEditorButton?.addEventListener("click", openSubjectEditor);

  closeSubjectEditorButton?.addEventListener("click", closeSubjectEditor);

  document
    .querySelectorAll("[data-close-subject-editor]")
    .forEach((element) => {
      element.addEventListener("click", closeSubjectEditor);
    });

  addSubjectForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    addNewSubject();
  });

  saveSubjectsButton?.addEventListener("click", applySubjectChanges);

  resetSubjectsButton?.addEventListener("click", () => {
    const confirmed = window.confirm("과목 목록을 기본값으로 초기화할까요?");

    if (!confirmed) {
      return;
    }

    editingSubjects = [...DEFAULT_SUBJECTS];

    renderSubjectEditorList();
  });

  window.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      subjectEditorModal &&
      !subjectEditorModal.hidden
    ) {
      closeSubjectEditor();
    }
  });
  subjectButtons.forEach((button) => {
    button.setAttribute("aria-pressed", "false");

    button.addEventListener("click", () => {
      selectSubject(button);
    });
  });
  // 대시보드 공부 시작
  startStudyButton?.addEventListener("click", startTimer);

  // 대시보드 공부 종료
  stopStudyButton?.addEventListener("click", saveTimerRecord);

  // 집중 화면 공부 종료
  focusStopButton?.addEventListener("click", saveTimerRecord);

  // 집중 다시 시작
  resumeFocusButton?.addEventListener("click", resumeTimer);

  // 공부 기록 삭제
  document
    .querySelectorAll(".record-delete-button, [data-delete-record]")
    .forEach((button) => {
      button.addEventListener("click", () => deleteStudyRecord(button));
    });

  // =========================================================
  // 다른 탭으로 이동하면 일시정지
  // =========================================================
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && timerState === "running") {
      pauseTimer(
        "다른 탭으로 이동하여 집중시간이 일시정지되었습니다. 다시 시작 버튼을 눌러 주세요.",
      );
    }
  });

  // =========================================================
  // 브라우저 밖으로 이동하면 일시정지
  // =========================================================
  window.addEventListener("blur", () => {
    if (timerState === "running") {
      pauseTimer(
        "브라우저 화면을 벗어나 집중시간이 일시정지되었습니다. 다시 시작 버튼을 눌러 주세요.",
      );
    }
  });

  // =========================================================
  // 공부 중 페이지 종료 경고
  // =========================================================
  window.addEventListener("beforeunload", (event) => {
    if (
      timerState === "running" ||
      timerState === "paused" ||
      timerState === "saving"
    ) {
      event.preventDefault();
      event.returnValue = "";
    }
  });

  // =========================================================
  // 초기 화면 설정
  // =========================================================
  if (focusMode) {
    focusMode.hidden = true;
  }
  renderSubjectButtons();
  updateTimerDisplay();
  updateTimerState("idle");
});
