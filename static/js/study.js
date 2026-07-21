"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const pageData = window.STUDY_PAGE_DATA || {};

  // =========================================================
  // 기본 설정
  // =========================================================

  const DEFAULT_SUBJECTS = [
    "국어",
    "수학",
    "영어",
    "기타",
  ];

  const SUBJECT_STORAGE_KEY = "studySubjects";
  const ACTIVE_SESSION_KEY = "activeStudySession";

  let currentTodaySeconds = Math.max(
    0,
    Number(pageData.todaySeconds || 0),
  );

  const goalSeconds = Math.max(
    1,
    Number(pageData.goalSeconds || 28800),
  );

  const focusUrl = String(
    pageData.focusUrl || "/focus",
  );

  const logoutUrl = String(
    pageData.logoutUrl || "/logout",
  );

  const deleteRecordUrlTemplate = String(
    pageData.deleteRecordUrlTemplate ||
      "/api/study-records/__RECORD_ID__",
  );

  // =========================================================
  // DOM
  // =========================================================

  const todayStudyTime =
    document.getElementById("todayStudyTime");

  const dailyGoalText =
    document.getElementById("dailyGoalText");

  const dailyGoalProgress =
    document.getElementById("dailyGoalProgress");

  const progressBar =
    document.querySelector(".progress-bar");

  const studyStatusBadge =
    document.getElementById("studyStatusBadge");

  const subjectList =
    document.getElementById("subjectList");

  const timerSubject =
    document.getElementById("timerSubject");

  const startStudyButton =
    document.getElementById("startStudyButton");

  const dashboardMessage =
    document.getElementById("dashboardMessage");

  const logoutButton =
    document.getElementById("logoutButton");

  const mobileLogoutButton =
    document.getElementById("mobileLogoutButton");

  const todayRecordList =
    document.getElementById("todayRecordList");

  const todayRecordCount =
    document.getElementById("todayRecordCount");

  // 과목 관리 모달
  const subjectEditorModal =
    document.getElementById("subjectEditorModal");

  const subjectEditorBackdrop =
    document.getElementById("subjectEditorBackdrop");

  const openSubjectEditorButton =
    document.getElementById(
      "openSubjectEditorButton",
    );

  const closeSubjectEditorButton =
    document.getElementById(
      "closeSubjectEditorButton",
    );

  const finishSubjectEditorButton =
    document.getElementById(
      "finishSubjectEditorButton",
    );

  const subjectAddForm =
    document.getElementById("subjectAddForm");

  const newSubjectInput =
    document.getElementById("newSubjectInput");

  const subjectEditorList =
    document.getElementById("subjectEditorList");

  const subjectEditorMessage =
    document.getElementById(
      "subjectEditorMessage",
    );

  // =========================================================
  // 상태
  // =========================================================

  let subjects = loadSubjects();
  let editingSubjects = [...subjects];
  let selectedSubject = "";

  // =========================================================
  // 공통 함수
  // =========================================================

  function formatTime(totalSeconds) {
    const safeSeconds = Math.max(
      0,
      Math.floor(Number(totalSeconds) || 0),
    );

    const hours = String(
      Math.floor(safeSeconds / 3600),
    ).padStart(2, "0");

    const minutes = String(
      Math.floor((safeSeconds % 3600) / 60),
    ).padStart(2, "0");

    const seconds = String(
      safeSeconds % 60,
    ).padStart(2, "0");

    return `${hours}:${minutes}:${seconds}`;
  }

  function normalizeSubjectName(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, " ");
  }

  function getSubjectIcon(subject) {
    return (
      normalizeSubjectName(subject).charAt(0) ||
      "?"
    );
  }

  function showMessage(
    element,
    message,
    type = "error",
  ) {
    if (!element) {
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
  // 과목 저장
  // =========================================================

  function loadSubjects() {
    try {
      const savedValue = localStorage.getItem(
        SUBJECT_STORAGE_KEY,
      );

      if (!savedValue) {
        return [...DEFAULT_SUBJECTS];
      }

      const parsedValue = JSON.parse(savedValue);

      if (!Array.isArray(parsedValue)) {
        return [...DEFAULT_SUBJECTS];
      }

      const normalizedSubjects = [
        ...new Set(
          parsedValue
            .map(normalizeSubjectName)
            .filter(Boolean),
        ),
      ].slice(0, 20);

      if (normalizedSubjects.length === 0) {
        return [...DEFAULT_SUBJECTS];
      }

      return normalizedSubjects;
    } catch (error) {
      console.error(
        "과목 목록 불러오기 오류:",
        error,
      );

      return [...DEFAULT_SUBJECTS];
    }
  }

  function saveSubjects() {
    try {
      localStorage.setItem(
        SUBJECT_STORAGE_KEY,
        JSON.stringify(subjects),
      );
    } catch (error) {
      console.error(
        "과목 목록 저장 오류:",
        error,
      );
    }
  }

  // =========================================================
  // 진행 중인 집중 세션
  // =========================================================

  function getActiveSession() {
    try {
      const savedSession = localStorage.getItem(
        ACTIVE_SESSION_KEY,
      );

      if (!savedSession) {
        return null;
      }

      const parsedSession =
        JSON.parse(savedSession);

      if (
        !parsedSession ||
        !parsedSession.subject ||
        !parsedSession.startedAt
      ) {
        localStorage.removeItem(
          ACTIVE_SESSION_KEY,
        );

        return null;
      }

      return parsedSession;
    } catch (error) {
      console.error(
        "진행 중 세션 확인 오류:",
        error,
      );

      localStorage.removeItem(
        ACTIVE_SESSION_KEY,
      );

      return null;
    }
  }

  // =========================================================
  // 대시보드 공부시간 표시
  // =========================================================

  function updateDailySummary(totalSeconds) {
    currentTodaySeconds = Math.max(
      0,
      Number(totalSeconds) || 0,
    );

    const currentMinutes = Math.floor(
      currentTodaySeconds / 60,
    );

    const goalMinutes = Math.floor(
      goalSeconds / 60,
    );

    const percentage = Math.min(
      100,
      Math.round(
        (currentTodaySeconds / goalSeconds) *
          100,
      ),
    );

    if (todayStudyTime) {
      todayStudyTime.textContent =
        formatTime(currentTodaySeconds);
    }

    if (dailyGoalText) {
      dailyGoalText.textContent =
        `${currentMinutes} / ${goalMinutes}분`;
    }

    if (dailyGoalProgress) {
      dailyGoalProgress.style.width =
        `${percentage}%`;
    }

    if (progressBar) {
      progressBar.setAttribute(
        "aria-valuenow",
        String(percentage),
      );
    }
  }

  function updateStudyStatus() {
    if (!studyStatusBadge) {
      return;
    }

    const activeSession =
      getActiveSession();

    if (activeSession) {
      studyStatusBadge.textContent =
        `${activeSession.subject} 공부 진행 중`;

      studyStatusBadge.classList.remove(
        "badge-idle",
      );

      studyStatusBadge.classList.add(
        "badge-active",
      );
    } else {
      studyStatusBadge.textContent =
        "공부 대기 중";

      studyStatusBadge.classList.remove(
        "badge-active",
      );

      studyStatusBadge.classList.add(
        "badge-idle",
      );
    }
  }

  function renderDashboardSummary() {
    updateDailySummary(currentTodaySeconds);
    updateStudyStatus();
  }

  // =========================================================
  // 과목 선택
  // =========================================================

  function selectSubject(subject) {
    selectedSubject =
      normalizeSubjectName(subject);

    if (timerSubject) {
      timerSubject.value = selectedSubject;
    }

    renderSubjectList();
    updateStartButton();
    hideMessage(dashboardMessage);
  }

  function updateStartButton() {
    if (!startStudyButton) {
      return;
    }

    const activeSession =
      getActiveSession();

    if (activeSession) {
      startStudyButton.disabled = false;

      startStudyButton.textContent =
        `${activeSession.subject} 집중 모드로 돌아가기`;

      return;
    }

    if (!selectedSubject) {
      startStudyButton.disabled = true;
      startStudyButton.textContent =
        "과목을 선택해 주세요";

      return;
    }

    startStudyButton.disabled = false;

    startStudyButton.textContent =
      `${selectedSubject} 공부 시작`;
  }

  function renderSubjectList() {
    if (!subjectList) {
      return;
    }

    subjectList.innerHTML = "";

    subjects.forEach((subject) => {
      const button =
        document.createElement("button");

      button.type = "button";
      button.className = "subject-button";
      button.dataset.subject = subject;

      if (subject === selectedSubject) {
        button.classList.add("active");
      }

      const icon =
        document.createElement("span");

      icon.className = "subject-icon";
      icon.textContent =
        getSubjectIcon(subject);

      const text =
        document.createElement("span");

      text.className = "subject-name";
      text.textContent = subject;

      button.append(icon, text);

      button.addEventListener(
        "click",
        () => {
          selectSubject(subject);
        },
      );

      subjectList.appendChild(button);
    });
  }

  // =========================================================
  // 집중 모드 이동
  // =========================================================

  function moveToFocus(subject) {
    const normalizedSubject =
      normalizeSubjectName(subject);

    if (!normalizedSubject) {
      return;
    }

    const destination =
      `${focusUrl}?subject=${encodeURIComponent(
        normalizedSubject,
      )}`;

    window.location.href = destination;
  }

  function startStudy() {
    hideMessage(dashboardMessage);

    const activeSession =
      getActiveSession();

    if (activeSession) {
      moveToFocus(activeSession.subject);
      return;
    }

    if (!selectedSubject) {
      showMessage(
        dashboardMessage,
        "공부할 과목을 먼저 선택해 주세요.",
      );

      return;
    }

    moveToFocus(selectedSubject);
  }

  // =========================================================
  // 과목 관리 모달
  // =========================================================

  function openSubjectEditor() {
    if (!subjectEditorModal) {
      return;
    }

    editingSubjects = [...subjects];

    hideMessage(subjectEditorMessage);
    renderSubjectEditorList();

    subjectEditorModal.hidden = false;
    document.body.style.overflow = "hidden";

    window.setTimeout(() => {
      newSubjectInput?.focus();
    }, 0);
  }

  function closeSubjectEditor() {
    if (!subjectEditorModal) {
      return;
    }

    subjectEditorModal.hidden = true;
    document.body.style.overflow = "";

    editingSubjects = [...subjects];

    hideMessage(subjectEditorMessage);

    if (newSubjectInput) {
      newSubjectInput.value = "";
    }
  }

  function finishSubjectEditor() {
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
    }

    renderSubjectList();
    updateStartButton();
    closeSubjectEditor();

    showMessage(
      dashboardMessage,
      "과목 목록이 저장되었습니다.",
      "success",
    );
  }

  function addSubject(event) {
    event.preventDefault();

    hideMessage(subjectEditorMessage);

    const subjectName =
      normalizeSubjectName(
        newSubjectInput?.value,
      );

    if (!subjectName) {
      showMessage(
        subjectEditorMessage,
        "추가할 과목 이름을 입력해 주세요.",
      );

      newSubjectInput?.focus();
      return;
    }

    if (subjectName.length > 20) {
      showMessage(
        subjectEditorMessage,
        "과목 이름은 20자 이하로 입력해 주세요.",
      );

      return;
    }

    const duplicated =
      editingSubjects.some(
        (subject) =>
          subject.toLowerCase() ===
          subjectName.toLowerCase(),
      );

    if (duplicated) {
      showMessage(
        subjectEditorMessage,
        "이미 등록된 과목입니다.",
      );

      return;
    }

    if (editingSubjects.length >= 20) {
      showMessage(
        subjectEditorMessage,
        "과목은 최대 20개까지 등록할 수 있습니다.",
      );

      return;
    }

    editingSubjects.push(subjectName);

    if (newSubjectInput) {
      newSubjectInput.value = "";
      newSubjectInput.focus();
    }

    renderSubjectEditorList();
  }

  function deleteEditingSubject(index) {
    if (
      index < 0 ||
      index >= editingSubjects.length
    ) {
      return;
    }

    editingSubjects.splice(index, 1);
    renderSubjectEditorList();
  }

  function moveEditingSubject(
    currentIndex,
    direction,
  ) {
    const destinationIndex =
      currentIndex + direction;

    if (
      currentIndex < 0 ||
      currentIndex >=
        editingSubjects.length ||
      destinationIndex < 0 ||
      destinationIndex >=
        editingSubjects.length
    ) {
      return;
    }

    const [movedSubject] =
      editingSubjects.splice(
        currentIndex,
        1,
      );

    editingSubjects.splice(
      destinationIndex,
      0,
      movedSubject,
    );

    renderSubjectEditorList();
  }

  function createEditorControlButton({
    text,
    title,
    className,
    disabled = false,
    onClick,
  }) {
    const button =
      document.createElement("button");

    button.type = "button";
    button.textContent = text;
    button.title = title;
    button.className = className;
    button.disabled = disabled;

    button.addEventListener(
      "click",
      onClick,
    );

    return button;
  }

  function renderSubjectEditorList() {
    if (!subjectEditorList) {
      return;
    }

    subjectEditorList.innerHTML = "";

    if (editingSubjects.length === 0) {
      const emptyMessage =
        document.createElement("p");

      emptyMessage.className =
        "empty-message";

      emptyMessage.textContent =
        "등록된 과목이 없습니다.";

      subjectEditorList.appendChild(
        emptyMessage,
      );

      return;
    }

    editingSubjects.forEach(
      (subject, index) => {
        const item =
          document.createElement("div");

        item.className =
          "subject-editor-item";

        const subjectInfo =
          document.createElement("div");

        subjectInfo.className =
          "subject-editor-info";

        const icon =
          document.createElement("span");

        icon.className = "subject-icon";
        icon.textContent =
          getSubjectIcon(subject);

        const name =
          document.createElement("span");

        name.className =
          "subject-editor-name";

        name.textContent = subject;

        subjectInfo.append(icon, name);

        const controls =
          document.createElement("div");

        controls.className =
          "subject-editor-controls";

        const upButton =
          createEditorControlButton({
            text: "↑",
            title: "위로 이동",
            className:
              "subject-order-button",
            disabled: index === 0,
            onClick: () => {
              moveEditingSubject(
                index,
                -1,
              );
            },
          });

        const downButton =
          createEditorControlButton({
            text: "↓",
            title: "아래로 이동",
            className:
              "subject-order-button",
            disabled:
              index ===
              editingSubjects.length - 1,
            onClick: () => {
              moveEditingSubject(
                index,
                1,
              );
            },
          });

        const deleteButton =
          createEditorControlButton({
            text: "삭제",
            title: "과목 삭제",
            className:
              "subject-delete-button",
            onClick: () => {
              deleteEditingSubject(index);
            },
          });

        controls.append(
          upButton,
          downButton,
          deleteButton,
        );

        item.append(
          subjectInfo,
          controls,
        );

        subjectEditorList.appendChild(item);
      },
    );
  }

  // =========================================================
  // 공부 기록 삭제
  // =========================================================

  function createDeleteRecordUrl(recordId) {
    return deleteRecordUrlTemplate.replace(
      "__RECORD_ID__",
      encodeURIComponent(recordId),
    );
  }

  function updateRecordCount() {
    if (
      !todayRecordList ||
      !todayRecordCount
    ) {
      return;
    }

    const recordItems =
      todayRecordList.querySelectorAll(
        ".home-record-item",
      );

    todayRecordCount.textContent =
      `${recordItems.length}개`;

    if (recordItems.length === 0) {
      todayRecordList.innerHTML = "";

      const emptyMessage =
        document.createElement("p");

      emptyMessage.className =
        "empty-message";

      emptyMessage.textContent =
        "아직 등록된 공부 기록이 없습니다.";

      todayRecordList.appendChild(
        emptyMessage,
      );
    }
  }

  function setDeleteButtonState(
    button,
    isDeleting,
  ) {
    if (!button) {
      return;
    }

    button.disabled = isDeleting;

    button.textContent = isDeleting
      ? "삭제 중..."
      : "삭제";
  }

  function extractUpdatedTodaySeconds(result) {
    const dailyStats =
      result.daily_stats ||
      result.dailyStats ||
      result.stats ||
      null;

    if (!dailyStats) {
      return null;
    }

    const value =
      dailyStats.total_seconds ??
      dailyStats.totalSeconds ??
      dailyStats.study_seconds ??
      dailyStats.studySeconds;

    if (value === undefined || value === null) {
      return null;
    }

    const seconds = Number(value);

    if (!Number.isFinite(seconds)) {
      return null;
    }

    return Math.max(0, seconds);
  }

  async function deleteStudyRecord(
    recordId,
    button,
  ) {
    if (!recordId || !button) {
      return;
    }

    const shouldDelete = window.confirm(
      "이 공부 기록을 삭제할까요?",
    );

    if (!shouldDelete) {
      return;
    }

    hideMessage(dashboardMessage);
    setDeleteButtonState(button, true);

    try {
      const response = await fetch(
        createDeleteRecordUrl(recordId),
        {
          method: "DELETE",
          headers: {
            Accept: "application/json",
          },
        },
      );

      let result = {};

      try {
        result = await response.json();
      } catch (jsonError) {
        console.error(
          "삭제 응답 JSON 변환 오류:",
          jsonError,
        );
      }

      if (!response.ok) {
        throw new Error(
          result.message ||
            result.error ||
            "공부 기록 삭제에 실패했습니다.",
        );
      }

      const recordItem = button.closest(
        ".home-record-item",
      );

      recordItem?.remove();
      updateRecordCount();

      const updatedTodaySeconds =
        extractUpdatedTodaySeconds(result);

      if (updatedTodaySeconds !== null) {
        updateDailySummary(
          updatedTodaySeconds,
        );

        showMessage(
          dashboardMessage,
          "공부 기록을 삭제했습니다.",
          "success",
        );
      } else {
        showMessage(
          dashboardMessage,
          "공부 기록을 삭제했습니다. 공부시간을 다시 불러옵니다.",
          "success",
        );

        window.setTimeout(() => {
          window.location.reload();
        }, 500);
      }
    } catch (error) {
      console.error(
        "공부 기록 삭제 오류:",
        error,
      );

      setDeleteButtonState(
        button,
        false,
      );

      showMessage(
        dashboardMessage,
        error.message ||
          "공부 기록 삭제 중 오류가 발생했습니다.",
      );
    }
  }

  function handleRecordListClick(event) {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const deleteButton = target.closest(
      ".record-delete-button",
    );

    if (
      !deleteButton ||
      !todayRecordList?.contains(
        deleteButton,
      )
    ) {
      return;
    }

    const recordId =
      deleteButton.dataset.recordId;

    deleteStudyRecord(
      recordId,
      deleteButton,
    );
  }

  // =========================================================
  // 로그아웃
  // =========================================================

  function logout() {
    window.location.href = logoutUrl;
  }

  // =========================================================
  // 키보드 처리
  // =========================================================

  function handleKeyDown(event) {
    if (
      event.key === "Escape" &&
      subjectEditorModal &&
      !subjectEditorModal.hidden
    ) {
      closeSubjectEditor();
    }
  }

  // =========================================================
  // 이벤트 연결
  // =========================================================

  function bindEvents() {
    startStudyButton?.addEventListener(
      "click",
      startStudy,
    );

    openSubjectEditorButton?.addEventListener(
      "click",
      openSubjectEditor,
    );

    closeSubjectEditorButton?.addEventListener(
      "click",
      closeSubjectEditor,
    );

    subjectEditorBackdrop?.addEventListener(
      "click",
      closeSubjectEditor,
    );

    finishSubjectEditorButton?.addEventListener(
      "click",
      finishSubjectEditor,
    );

    subjectAddForm?.addEventListener(
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

    todayRecordList?.addEventListener(
      "click",
      handleRecordListClick,
    );

    document.addEventListener(
      "keydown",
      handleKeyDown,
    );
  }

  // =========================================================
  // 초기화
  // =========================================================

  function initialize() {
    renderDashboardSummary();
    renderSubjectList();
    updateStartButton();
    updateRecordCount();
    bindEvents();
  }

  initialize();
});