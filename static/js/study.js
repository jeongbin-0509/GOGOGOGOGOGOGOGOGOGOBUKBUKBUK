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
    Number(pageData.todaySeconds) || 0,
  );

  let currentTotalSeconds = 0;

  const goalSeconds = Math.max(
    1,
    Number(pageData.goalSeconds) || 28800,
  );

  const focusUrl = String(
    pageData.focusUrl || "/focus",
  );

  const logoutUrl = String(
    pageData.logoutUrl || "/logout",
  );

  const updateRecordUrlTemplate = String(
    pageData.updateRecordUrlTemplate ||
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
    document.getElementById(
      "dailyGoalProgress",
    );

  const progressBar =
    document.querySelector(".progress-bar");

  const studyStatusBadge =
    document.getElementById(
      "studyStatusBadge",
    );

  const subjectList =
    document.getElementById("subjectList");

  const timerSubject =
    document.getElementById("timerSubject");

  const startStudyButton =
    document.getElementById(
      "startStudyButton",
    );

  const dashboardMessage =
    document.getElementById(
      "dashboardMessage",
    );

  const logoutButton =
    document.getElementById(
      "logoutButton",
    );

  const mobileLogoutButton =
    document.getElementById(
      "mobileLogoutButton",
    );

  const todayRecordList =
    document.getElementById(
      "todayRecordList",
    );

  const todayRecordCount =
    document.getElementById(
      "todayRecordCount",
    );

  const totalStudyHours =
    document.getElementById(
      "totalStudyHours",
    );

  const totalStudyDetail =
    document.getElementById(
      "totalStudyDetail",
    );

  const subjectEditorModal =
    document.getElementById(
      "subjectEditorModal",
    );

  const subjectEditorBackdrop =
    document.getElementById(
      "subjectEditorBackdrop",
    );

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
    document.getElementById(
      "subjectAddForm",
    );

  const newSubjectInput =
    document.getElementById(
      "newSubjectInput",
    );

  const subjectEditorList =
    document.getElementById(
      "subjectEditorList",
    );

  const subjectEditorMessage =
    document.getElementById(
      "subjectEditorMessage",
    );

  // =========================================================
  // 상태
  // =========================================================

  let subjects = [];
  let editingSubjects = [];
  let selectedSubject = "";

  let editingRecord = null;
  let recordEditModal = null;

  // =========================================================
  // 공통 함수
  // =========================================================

  function escapeHTML(value) {
    const element =
      document.createElement("div");

    element.textContent = String(
      value ?? "",
    );

    return element.innerHTML;
  }

  function formatClock(totalSeconds) {
    const safeSeconds = Math.max(
      0,
      Math.floor(
        Number(totalSeconds) || 0,
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

  function formatFlexibleDuration(
    totalSeconds,
  ) {
    const safeSeconds = Math.max(
      0,
      Math.floor(
        Number(totalSeconds) || 0,
      ),
    );

    const hours = Math.floor(
      safeSeconds / 3600,
    );

    const minutes = Math.floor(
      (safeSeconds % 3600) / 60,
    );

    const seconds =
      safeSeconds % 60;

    const parts = [];

    if (hours > 0) {
      parts.push(`${hours}시간`);
    }

    if (minutes > 0) {
      parts.push(`${minutes}분`);
    }

    if (seconds > 0) {
      parts.push(`${seconds}초`);
    }

    if (parts.length === 0) {
      return "0초";
    }

    return parts.join(" ");
  }

  function parseLocalDate(value) {
    const dateText = String(
      value || "",
    ).slice(0, 10);

    const parts = dateText
      .split("-")
      .map(Number);

    if (
      parts.length !== 3 ||
      !parts[0] ||
      !parts[1] ||
      !parts[2]
    ) {
      return null;
    }

    return new Date(
      parts[0],
      parts[1] - 1,
      parts[2],
    );
  }

  function formatRelativeDate(value) {
    const recordDate =
      parseLocalDate(value);

    if (!recordDate) {
      return "";
    }

    const today = new Date();

    today.setHours(0, 0, 0, 0);
    recordDate.setHours(0, 0, 0, 0);

    const differenceDays = Math.round(
      (
        today.getTime() -
        recordDate.getTime()
      ) / 86400000,
    );

    if (differenceDays <= 0) {
      return "오늘";
    }

    return `${differenceDays}일 전`;
  }

  function normalizeSubjectName(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, " ");
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
    element.className =
      `form-message ${type}`;

    element.hidden = false;
  }

  function hideMessage(element) {
    if (!element) {
      return;
    }

    element.textContent = "";
    element.className =
      "form-message";

    element.hidden = true;
  }

  async function requestJSON(
    url,
    options = {},
  ) {
    const response = await fetch(url, {
      method: options.method || "GET",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type":
          "application/json",
        ...(options.headers || {}),
      },
      body:
        options.body === undefined
          ? undefined
          : JSON.stringify(
              options.body,
            ),
    });

    let result = {};

    try {
      result = await response.json();
    } catch {
      result = {};
    }

    if (response.status === 401) {
      window.location.href =
        "/login";

      throw new Error(
        "로그인이 필요합니다.",
      );
    }

    if (!response.ok) {
      throw new Error(
        result.message ||
          result.error ||
          "요청을 처리하지 못했습니다.",
      );
    }

    return result;
  }

  // =========================================================
  // 과목 DB 저장 및 기존 localStorage 마이그레이션
  // =========================================================

  function loadLegacySubjects() {
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

      return normalizedSubjects.length > 0
        ? normalizedSubjects
        : [...DEFAULT_SUBJECTS];
    } catch (error) {
      console.error(
        "기존 과목 목록 확인 오류:",
        error,
      );

      return [...DEFAULT_SUBJECTS];
    }
  }

  function removeLegacySubjects() {
    try {
      localStorage.removeItem(
        SUBJECT_STORAGE_KEY,
      );
    } catch (error) {
      console.error(
        "기존 과목 목록 삭제 오류:",
        error,
      );
    }
  }

  async function requestSaveSubjects(
    nextSubjects,
  ) {
    const result = await requestJSON(
      "/api/study-subjects",
      {
        method: "PUT",
        body: {
          subjects: nextSubjects,
        },
      },
    );

    return Array.isArray(result.subjects)
      ? result.subjects
          .map(normalizeSubjectName)
          .filter(Boolean)
      : [...nextSubjects];
  }

  async function loadSubjects() {
    const result = await requestJSON(
      "/api/study-subjects",
    );

    let loadedSubjects = Array.isArray(
      result.subjects,
    )
      ? result.subjects
          .map(normalizeSubjectName)
          .filter(Boolean)
      : [];

    // DB에 과목이 한 번도 저장되지 않은 계정은 기존
    // localStorage 목록을 최초 1회 DB로 이전한다.
    if (
      !result.initialized ||
      loadedSubjects.length === 0
    ) {
      loadedSubjects = await requestSaveSubjects(
        loadLegacySubjects(),
      );
    }

    subjects = loadedSubjects;
    editingSubjects = [...subjects];
    removeLegacySubjects();

    renderSubjectList();
    updateStartButton();
  }

  // =========================================================
  // 진행 중인 집중 세션
  // =========================================================

  function getActiveSession() {
    try {
      const savedSession =
        localStorage.getItem(
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
  // 공부시간 표시
  // =========================================================

  function updateDailySummary(
    totalSeconds,
  ) {
    currentTodaySeconds = Math.max(
      0,
      Number(totalSeconds) || 0,
    );

    const currentMinutes =
      Math.floor(
        currentTodaySeconds / 60,
      );

    const goalMinutes =
      Math.floor(goalSeconds / 60);

    const percentage = Math.min(
      100,
      Math.round(
        (
          currentTodaySeconds /
          goalSeconds
        ) * 100,
      ),
    );

    if (todayStudyTime) {
      todayStudyTime.textContent =
        formatClock(
          currentTodaySeconds,
        );
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

  function updateTotalSummary(
    totalSeconds,
  ) {
    currentTotalSeconds = Math.max(
      0,
      Number(totalSeconds) || 0,
    );

    const formatted =
      formatFlexibleDuration(
        currentTotalSeconds,
      );

    if (totalStudyHours) {
      totalStudyHours.textContent =
        formatted;

      totalStudyHours.style.fontSize =
        "clamp(2rem, 5vw, 4rem)";

      totalStudyHours.style.lineHeight =
        "1.15";
    }

    const unitElement =
      totalStudyHours?.nextElementSibling;

    if (
      unitElement &&
      unitElement.matches(
        ".body",
      )
    ) {
      unitElement.hidden = true;
    }

    if (totalStudyDetail) {
      totalStudyDetail.textContent =
        `총 ${formatted} 동안 공부했습니다.`;
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
    updateDailySummary(
      currentTodaySeconds,
    );

    updateStudyStatus();
  }

  // =========================================================
  // 공부 기록 조회 및 표시
  // =========================================================

  async function loadStudySummary() {
    if (todayRecordList) {
      todayRecordList.innerHTML = `
        <p class="empty-message">
          공부 기록을 불러오는 중입니다.
        </p>
      `;
    }

    try {
      const result =
        await requestJSON(
          "/api/study-summary",
        );

      updateDailySummary(
        result.today_seconds,
      );

      updateTotalSummary(
        result.total_seconds,
      );

      renderStudyRecords(
        result.recent_records || [],
      );
    } catch (error) {
      console.error(
        "공부 요약 불러오기 오류:",
        error,
      );

      if (todayRecordList) {
        todayRecordList.innerHTML = `
          <p class="empty-message">
            공부 기록을 불러오지 못했습니다.
          </p>
        `;
      }

      showMessage(
        dashboardMessage,
        error.message,
      );
    }
  }

  function renderStudyRecords(records) {
    if (
      !todayRecordList ||
      !todayRecordCount
    ) {
      return;
    }

    todayRecordList.innerHTML = "";
    todayRecordCount.textContent =
      `${records.length}개`;

    if (records.length === 0) {
      todayRecordList.innerHTML = `
        <p class="empty-message">
          아직 등록된 공부 기록이 없습니다.
        </p>
      `;

      return;
    }

    records.forEach((record) => {
      const item =
        document.createElement("div");

      item.className =
        "home-record-item";

      item.dataset.recordId =
        String(record.id || "");

      const durationSeconds =
        Math.max(
          0,
          Number(
            record.duration_seconds,
          ) || 0,
        );

      const subject =
        record.subject ||
        record.subject_name ||
        "과목";

      const relativeDate =
        formatRelativeDate(
          record.study_date,
        );

      item.innerHTML = `
        <div class="home-record-info">
          <strong>
            ${escapeHTML(subject)}
          </strong>

          <span class="record-duration-text">
            ${escapeHTML(
              formatFlexibleDuration(
                durationSeconds,
              ),
            )}
          </span>

          <span class="record-relative-date">
            ${escapeHTML(relativeDate)}
          </span>
        </div>

        <div class="home-record-right">
          <button
            class="record-edit-button"
            type="button"
          >
            수정
          </button>
        </div>
      `;

      const editButton =
        item.querySelector(
          ".record-edit-button",
        );

      editButton.addEventListener(
        "click",
        () => {
          openRecordEditModal({
            ...record,
            subject,
            duration_seconds:
              durationSeconds,
          });
        },
      );

      todayRecordList.appendChild(
        item,
      );
    });
  }

  // =========================================================
  // 기록 수정 모달
  // =========================================================

  function installRecordEditStyles() {
    if (
      document.getElementById(
        "recordEditDynamicStyles",
      )
    ) {
      return;
    }

    const style =
      document.createElement("style");

    style.id =
      "recordEditDynamicStyles";

    style.textContent = `
      .home-record-item {
        align-items: center;
      }

      .home-record-info {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 3px;
      }

      .home-record-info strong {
        font-size: 1.05rem;
      }

      .record-duration-text {
        color: var(--text, #111827);
        font-size: 1rem;
        font-weight: 700;
      }

      .record-relative-date {
        color: var(--muted, #6b7280);
        font-size: 0.88rem;
      }

      .record-edit-button {
        border: 0;
        border-radius: 12px;
        padding: 10px 14px;
        background: #eef2ff;
        color: #4f46e5;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }

      .record-edit-button:hover {
        background: #e0e7ff;
      }

      .record-edit-button:disabled {
        cursor: not-allowed;
        opacity: 0.6;
      }

      .record-edit-modal {
        position: fixed;
        z-index: 2000;
        inset: 0;
        display: grid;
        place-items: center;
        padding: 20px;
      }

      .record-edit-modal[hidden] {
        display: none;
      }

      .record-edit-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(15, 23, 42, 0.55);
      }

      .record-edit-panel {
        position: relative;
        z-index: 1;
        width: min(100%, 440px);
        border-radius: 22px;
        padding: 24px;
        background: #ffffff;
        box-shadow:
          0 24px 80px
          rgba(15, 23, 42, 0.24);
      }

      .record-edit-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
      }

      .record-edit-header h2 {
        margin: 4px 0 0;
        font-size: 1.4rem;
      }

      .record-edit-close {
        width: 38px;
        height: 38px;
        border: 0;
        border-radius: 50%;
        background: #f3f4f6;
        font-size: 1.5rem;
        cursor: pointer;
      }

      .record-edit-current {
        margin: 20px 0;
        border-radius: 14px;
        padding: 14px 16px;
        background: #f8fafc;
      }

      .record-edit-current span {
        display: block;
        color: #64748b;
        font-size: 0.88rem;
      }

      .record-edit-current strong {
        display: block;
        margin-top: 4px;
        font-size: 1.15rem;
      }

      .record-edit-time-inputs {
        display: grid;
        grid-template-columns:
          repeat(3, minmax(0, 1fr));
        gap: 10px;
      }

      .record-edit-field {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .record-edit-field label {
        color: #64748b;
        font-size: 0.85rem;
        font-weight: 700;
      }

      .record-edit-field input {
        width: 100%;
        border: 1px solid #dbe2ea;
        border-radius: 12px;
        padding: 12px 10px;
        font: inherit;
        text-align: center;
      }

      .record-edit-help {
        margin: 12px 0 0;
        color: #64748b;
        font-size: 0.85rem;
        line-height: 1.5;
      }

      .record-edit-message {
        margin: 12px 0 0;
        color: #dc2626;
        font-size: 0.9rem;
        font-weight: 600;
      }

      .record-edit-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 22px;
      }

      @media (max-width: 520px) {
        .record-edit-panel {
          padding: 20px;
        }

        .record-edit-time-inputs {
          gap: 7px;
        }

        .record-edit-field input {
          padding-inline: 6px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function createRecordEditModal() {
    installRecordEditStyles();

    const modal =
      document.createElement("section");

    modal.className =
      "record-edit-modal";

    modal.hidden = true;

    modal.setAttribute(
      "role",
      "dialog",
    );

    modal.setAttribute(
      "aria-modal",
      "true",
    );

    modal.innerHTML = `
      <div
        class="record-edit-backdrop"
        data-record-edit-close
      ></div>

      <div class="record-edit-panel">
        <div class="record-edit-header">
          <div>
            <p class="caption">
              공부 기록 변경
            </p>

            <h2 id="recordEditTitle">
              공부시간 수정
            </h2>
          </div>

          <button
            class="record-edit-close"
            type="button"
            data-record-edit-close
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div class="record-edit-current">
          <span>
            현재 공부시간
          </span>

          <strong
            id="recordEditCurrentTime"
          ></strong>
        </div>

        <form id="recordEditForm">
          <div class="record-edit-time-inputs">
            <div class="record-edit-field">
              <label for="recordEditHours">
                시간
              </label>

              <input
                id="recordEditHours"
                type="number"
                min="0"
                step="1"
                inputmode="numeric"
                required
              />
            </div>

            <div class="record-edit-field">
              <label for="recordEditMinutes">
                분
              </label>

              <input
                id="recordEditMinutes"
                type="number"
                min="0"
                max="59"
                step="1"
                inputmode="numeric"
                required
              />
            </div>

            <div class="record-edit-field">
              <label for="recordEditSeconds">
                초
              </label>

              <input
                id="recordEditSeconds"
                type="number"
                min="0"
                max="59"
                step="1"
                inputmode="numeric"
                required
              />
            </div>
          </div>

          <p class="record-edit-help">
            기존 공부시간보다 줄이는 것만 가능합니다.
            최소 1초 이상 입력해 주세요.
          </p>

          <p
            id="recordEditMessage"
            class="record-edit-message"
            hidden
          ></p>

          <div class="record-edit-actions">
            <button
              class="btn btn-outline"
              type="button"
              data-record-edit-close
            >
              취소
            </button>

            <button
              id="recordEditSubmit"
              class="btn btn-primary"
              type="submit"
            >
              수정 완료
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    modal
      .querySelectorAll(
        "[data-record-edit-close]",
      )
      .forEach((element) => {
        element.addEventListener(
          "click",
          closeRecordEditModal,
        );
      });

    modal
      .querySelector(
        "#recordEditForm",
      )
      .addEventListener(
        "submit",
        submitRecordEdit,
      );

    return modal;
  }

  function getRecordEditElement(
    selector,
  ) {
    return recordEditModal?.querySelector(
      selector,
    );
  }

  function setRecordEditMessage(
    message,
  ) {
    const element =
      getRecordEditElement(
        "#recordEditMessage",
      );

    if (!element) {
      return;
    }

    element.textContent =
      message || "";

    element.hidden = !message;
  }

  function openRecordEditModal(record) {
    if (!recordEditModal) {
      recordEditModal =
        createRecordEditModal();
    }

    editingRecord = record;

    const totalSeconds = Math.max(
      0,
      Math.floor(
        Number(
          record.duration_seconds,
        ) || 0,
      ),
    );

    const hours = Math.floor(
      totalSeconds / 3600,
    );

    const minutes = Math.floor(
      (totalSeconds % 3600) / 60,
    );

    const seconds =
      totalSeconds % 60;

    const title =
      getRecordEditElement(
        "#recordEditTitle",
      );

    const currentTime =
      getRecordEditElement(
        "#recordEditCurrentTime",
      );

    const hoursInput =
      getRecordEditElement(
        "#recordEditHours",
      );

    const minutesInput =
      getRecordEditElement(
        "#recordEditMinutes",
      );

    const secondsInput =
      getRecordEditElement(
        "#recordEditSeconds",
      );

    title.textContent =
      `${record.subject} 공부시간 수정`;

    currentTime.textContent =
      formatFlexibleDuration(
        totalSeconds,
      );

    hoursInput.value =
      String(hours);

    minutesInput.value =
      String(minutes);

    secondsInput.value =
      String(seconds);

    setRecordEditMessage("");

    recordEditModal.hidden = false;
    document.body.style.overflow =
      "hidden";

    window.setTimeout(() => {
      hoursInput.focus();
      hoursInput.select();
    }, 0);
  }

  function closeRecordEditModal() {
    if (!recordEditModal) {
      return;
    }

    recordEditModal.hidden = true;
    editingRecord = null;
    setRecordEditMessage("");

    if (
      !subjectEditorModal ||
      subjectEditorModal.hidden
    ) {
      document.body.style.overflow =
        "";
    }
  }

  function getEditedDurationSeconds() {
    const hours = Math.max(
      0,
      Math.floor(
        Number(
          getRecordEditElement(
            "#recordEditHours",
          )?.value,
        ) || 0,
      ),
    );

    const minutes = Math.max(
      0,
      Math.floor(
        Number(
          getRecordEditElement(
            "#recordEditMinutes",
          )?.value,
        ) || 0,
      ),
    );

    const seconds = Math.max(
      0,
      Math.floor(
        Number(
          getRecordEditElement(
            "#recordEditSeconds",
          )?.value,
        ) || 0,
      ),
    );

    if (
      minutes > 59 ||
      seconds > 59
    ) {
      return null;
    }

    return (
      hours * 3600 +
      minutes * 60 +
      seconds
    );
  }

  async function submitRecordEdit(
    event,
  ) {
    event.preventDefault();

    if (!editingRecord) {
      return;
    }

    const newDuration =
      getEditedDurationSeconds();

    const previousDuration =
      Math.max(
        0,
        Number(
          editingRecord.duration_seconds,
        ) || 0,
      );

    if (newDuration === null) {
      setRecordEditMessage(
        "분과 초는 0부터 59까지 입력해 주세요.",
      );

      return;
    }

    if (newDuration < 1) {
      setRecordEditMessage(
        "공부시간은 최소 1초 이상이어야 합니다.",
      );

      return;
    }

    if (
      newDuration >= previousDuration
    ) {
      setRecordEditMessage(
        "기존 공부시간보다 줄이는 것만 가능합니다.",
      );

      return;
    }

    const submitButton =
      getRecordEditElement(
        "#recordEditSubmit",
      );

    submitButton.disabled = true;
    submitButton.textContent =
      "수정 중...";

    setRecordEditMessage("");

    try {
      const url =
        updateRecordUrlTemplate.replace(
          "__RECORD_ID__",
          encodeURIComponent(
            editingRecord.id,
          ),
        );

      const result =
        await requestJSON(url, {
          method: "PATCH",
          body: {
            duration_seconds:
              newDuration,
          },
        });

      updateDailySummary(
        result.today_seconds ??
          result.daily_stats
            ?.total_seconds ??
          currentTodaySeconds,
      );

      updateTotalSummary(
        result.total_seconds ??
          currentTotalSeconds,
      );

      closeRecordEditModal();

      await loadStudySummary();

      showMessage(
        dashboardMessage,
        "공부시간을 수정했습니다.",
        "success",
      );
    } catch (error) {
      console.error(
        "공부 기록 수정 오류:",
        error,
      );

      setRecordEditMessage(
        error.message,
      );
    } finally {
      submitButton.disabled = false;
      submitButton.textContent =
        "수정 완료";
    }
  }

  // =========================================================
  // 과목 선택
  // =========================================================

  function selectSubject(subject) {
    selectedSubject =
      normalizeSubjectName(subject);

    if (timerSubject) {
      timerSubject.value =
        selectedSubject;
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
        document.createElement(
          "button",
        );

      button.type = "button";
      button.className =
        "subject-choice-button";

      button.textContent = subject;

      if (
        subject === selectedSubject
      ) {
        button.classList.add(
          "active",
        );
      }

      button.setAttribute(
        "aria-pressed",
        String(
          subject === selectedSubject,
        ),
      );

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

    window.location.href =
      destination;
  }

  function startStudy() {
    hideMessage(dashboardMessage);

    const activeSession =
      getActiveSession();

    if (activeSession) {
      moveToFocus(
        activeSession.subject,
      );

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

    hideMessage(
      subjectEditorMessage,
    );

    renderSubjectEditorList();

    subjectEditorModal.hidden =
      false;

    document.body.style.overflow =
      "hidden";

    window.setTimeout(() => {
      newSubjectInput?.focus();
    }, 0);
  }

  function closeSubjectEditor() {
    if (!subjectEditorModal) {
      return;
    }

    subjectEditorModal.hidden = true;
    editingSubjects = [...subjects];

    hideMessage(
      subjectEditorMessage,
    );

    if (newSubjectInput) {
      newSubjectInput.value = "";
    }

    if (
      !recordEditModal ||
      recordEditModal.hidden
    ) {
      document.body.style.overflow =
        "";
    }
  }

  async function finishSubjectEditor() {
    if (editingSubjects.length === 0) {
      showMessage(
        subjectEditorMessage,
        "과목은 최소 1개 이상 있어야 합니다.",
      );

      return;
    }

    const previousSubjects = [...subjects];

    if (finishSubjectEditorButton) {
      finishSubjectEditorButton.disabled = true;
      finishSubjectEditorButton.textContent =
        "저장 중...";
    }

    hideMessage(subjectEditorMessage);

    try {
      subjects = await requestSaveSubjects(
        editingSubjects,
      );

      editingSubjects = [...subjects];
      removeLegacySubjects();

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
    } catch (error) {
      subjects = previousSubjects;

      console.error(
        "과목 목록 저장 오류:",
        error,
      );

      showMessage(
        subjectEditorMessage,
        error.message ||
          "과목 목록을 저장하지 못했습니다.",
      );
    } finally {
      if (finishSubjectEditorButton) {
        finishSubjectEditorButton.disabled = false;
        finishSubjectEditorButton.textContent =
          "완료";
      }
    }
  }

  function addSubject(event) {
    event.preventDefault();

    hideMessage(
      subjectEditorMessage,
    );

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

    if (
      editingSubjects.length >= 20
    ) {
      showMessage(
        subjectEditorMessage,
        "과목은 최대 20개까지 등록할 수 있습니다.",
      );

      return;
    }

    editingSubjects.push(
      subjectName,
    );

    if (newSubjectInput) {
      newSubjectInput.value = "";
      newSubjectInput.focus();
    }

    renderSubjectEditorList();
  }

  function deleteEditingSubject(
    index,
  ) {
    if (
      index < 0 ||
      index >=
        editingSubjects.length
    ) {
      return;
    }

    editingSubjects.splice(
      index,
      1,
    );

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
      document.createElement(
        "button",
      );

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

    if (
      editingSubjects.length === 0
    ) {
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
          document.createElement(
            "div",
          );

        item.className =
          "subject-editor-item";

        const subjectInfo =
          document.createElement(
            "div",
          );

        subjectInfo.className =
          "subject-editor-info";

        const name =
          document.createElement(
            "span",
          );

        name.className =
          "subject-editor-name";

        name.textContent = subject;

        subjectInfo.append(name);

        const controls =
          document.createElement(
            "div",
          );

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
              deleteEditingSubject(
                index,
              );
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

        subjectEditorList.appendChild(
          item,
        );
      },
    );
  }

  // =========================================================
  // 로그아웃
  // =========================================================

  function logout() {
    window.location.href =
      logoutUrl;
  }

  // =========================================================
  // 키보드 처리
  // =========================================================

  function handleKeyDown(event) {
    if (event.key !== "Escape") {
      return;
    }

    if (
      recordEditModal &&
      !recordEditModal.hidden
    ) {
      closeRecordEditModal();
      return;
    }

    if (
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
    startStudyButton
      ?.addEventListener(
        "click",
        startStudy,
      );

    openSubjectEditorButton
      ?.addEventListener(
        "click",
        openSubjectEditor,
      );

    closeSubjectEditorButton
      ?.addEventListener(
        "click",
        closeSubjectEditor,
      );

    subjectEditorBackdrop
      ?.addEventListener(
        "click",
        closeSubjectEditor,
      );

    finishSubjectEditorButton
      ?.addEventListener(
        "click",
        finishSubjectEditor,
      );

    subjectAddForm
      ?.addEventListener(
        "submit",
        addSubject,
      );

    logoutButton
      ?.addEventListener(
        "click",
        logout,
      );

    mobileLogoutButton
      ?.addEventListener(
        "click",
        logout,
      );

    document.addEventListener(
      "keydown",
      handleKeyDown,
    );
  }

  // =========================================================
  // 초기화
  // =========================================================

  async function initialize() {
    renderDashboardSummary();
    bindEvents();

    if (subjectList) {
      subjectList.innerHTML = `
        <p class="empty-message">
          과목 목록을 불러오는 중입니다.
        </p>
      `;
    }

    await Promise.allSettled([
      loadStudySummary(),
      loadSubjects().catch((error) => {
        console.error(
          "과목 목록 초기화 오류:",
          error,
        );

        subjects = loadLegacySubjects();
        editingSubjects = [...subjects];
        renderSubjectList();
        updateStartButton();

        showMessage(
          dashboardMessage,
          error.message ||
            "과목 목록을 불러오지 못했습니다.",
        );
      }),
    ]);
  }

  initialize();
});