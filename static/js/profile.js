"use strict";

// =========================================================
// DOM
// =========================================================

const profileAvatarDOM =
  document.getElementById("profileAvatar");

const profileNameDOM =
  document.getElementById("profileName");

const profileDescriptionDOM =
  document.getElementById("profileDescription");

const profileInfoNameDOM =
  document.getElementById("profileInfoName");

const profileStudentNumberDOM =
  document.getElementById("profileStudentNumber");

const profileClassNameDOM =
  document.getElementById("profileClassName");

const profileEmailDOM =
  document.getElementById("profileEmail");

const profileTodayTimeDOM =
  document.getElementById("profileTodayTime");

const profileTotalTimeDOM =
  document.getElementById("profileTotalTime");

const profileAverageGradeDOM =
  document.getElementById("profileAverageGrade");

const profileGradeDescriptionDOM =
  document.getElementById("profileGradeDescription");

const profileMeasuredDaysDOM =
  document.getElementById("profileMeasuredDays");

const goalFormDOM =
  document.getElementById("goalForm");

const goalHoursDOM =
  document.getElementById("goalHours");

const goalMinutesDOM =
  document.getElementById("goalMinutes");

const goalSaveButtonDOM =
  document.getElementById("goalSaveButton");

const goalMessageDOM =
  document.getElementById("goalMessage");

const goalStatusBadgeDOM =
  document.getElementById("goalStatusBadge");

const profileMessageDOM =
  document.getElementById("profileMessage");

const profileEditFormDOM =
  document.getElementById("profileEditForm");

const profileEditNameDOM =
  document.getElementById("profileEditName");

const profileEditStudentIdDOM =
  document.getElementById("profileEditStudentId");

const profileCurrentPasswordDOM =
  document.getElementById("profileCurrentPassword");

const profileNewPasswordDOM =
  document.getElementById("profileNewPassword");

const profileNewPasswordConfirmDOM =
  document.getElementById("profileNewPasswordConfirm");

const profileEditSaveButtonDOM =
  document.getElementById("profileEditSaveButton");

const profileEditMessageDOM =
  document.getElementById("profileEditMessage");

const profileEditStatusBadgeDOM =
  document.getElementById("profileEditStatusBadge");

const logoutButtonDOM =
  document.getElementById("logoutButton");

const profileLogoutButtonDOM =
  document.getElementById("profileLogoutButton");

const mobileLogoutButtonDOM =
  document.getElementById("mobileLogoutButton");

// =========================================================
// API
// =========================================================

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
    body:
      options.body === undefined
        ? undefined
        : JSON.stringify(options.body),
  });

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
    throw new Error(
      result?.message ||
        result?.error ||
        "요청을 처리하지 못했습니다.",
    );
  }

  return result;
}

// =========================================================
// 공통 함수
// =========================================================

function formatSeconds(totalSeconds) {
  const safeSeconds = Math.max(
    0,
    Number(totalSeconds) || 0,
  );

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

function getInitial(name) {
  const safeName = String(name || "사용자").trim();

  return safeName.charAt(0) || "나";
}

function showProfileMessage(message) {
  profileMessageDOM.textContent = message;
  profileMessageDOM.hidden = false;
}

function hideProfileMessage() {
  profileMessageDOM.textContent = "";
  profileMessageDOM.hidden = true;
}

function showGoalMessage(message, isError = false) {
  goalMessageDOM.textContent = message;
  goalMessageDOM.hidden = false;

  goalMessageDOM.classList.toggle(
    "error",
    isError,
  );

  goalMessageDOM.classList.toggle(
    "success",
    !isError,
  );
}

function hideGoalMessage() {
  goalMessageDOM.textContent = "";
  goalMessageDOM.hidden = true;
  goalMessageDOM.classList.remove(
    "error",
    "success",
  );
}

function setGoalLoading(isLoading) {
  goalSaveButtonDOM.disabled = isLoading;

  goalSaveButtonDOM.textContent = isLoading
    ? "저장 중..."
    : "목표 저장";
}

function showProfileEditMessage(
  message,
  isError = false,
) {
  profileEditMessageDOM.textContent = message;
  profileEditMessageDOM.hidden = false;
  profileEditMessageDOM.classList.toggle(
    "error",
    isError,
  );
  profileEditMessageDOM.classList.toggle(
    "success",
    !isError,
  );
}

function hideProfileEditMessage() {
  profileEditMessageDOM.textContent = "";
  profileEditMessageDOM.hidden = true;
  profileEditMessageDOM.classList.remove(
    "error",
    "success",
  );
}

function setProfileEditLoading(isLoading) {
  profileEditSaveButtonDOM.disabled = isLoading;
  profileEditSaveButtonDOM.textContent = isLoading
    ? "저장 중..."
    : "변경사항 저장";
}

// =========================================================
// 프로필 출력
// =========================================================

function renderProfile(data) {
  const user = data.user || {};

  const name =
    user.name ||
    user.username ||
    user.user_name ||
    "사용자";

  const studentNumber =
    user.student_number ||
    user.student_id ||
    user.usernum ||
    "-";

  const className =
    user.class_name ||
    user.student_class ||
    user.class ||
    "-";

  const email = user.email || "-";

  profileAvatarDOM.textContent =
    getInitial(name);

  profileNameDOM.textContent = name;

  profileDescriptionDOM.textContent =
    className !== "-"
      ? `${className}에서 목표를 향해 공부하고 있습니다.`
      : "목표를 향해 공부하고 있습니다.";

  profileInfoNameDOM.textContent = name;
  profileStudentNumberDOM.textContent =
    studentNumber;
  profileClassNameDOM.textContent =
    className;
  profileEmailDOM.textContent = email;

  profileEditNameDOM.value = name;
  profileEditStudentIdDOM.value =
    studentNumber === "-" ? "" : studentNumber;

  profileTodayTimeDOM.textContent =
    formatSeconds(data.today_seconds);

  profileTotalTimeDOM.textContent =
    formatSeconds(data.total_seconds);

  const displayGrade =
    Number(data.display_grade) || 5;

  const averageGrade =
    Number(data.average_grade) || 5;

  const measuredDays =
    Number(data.measured_days) || 0;

  profileAverageGradeDOM.textContent =
    `${displayGrade}등급`;

  profileMeasuredDaysDOM.textContent =
    `${measuredDays}일`;

  profileGradeDescriptionDOM.textContent =
    measuredDays > 0
      ? `일별 등급 평균은 ${averageGrade.toFixed(1)}등급입니다.`
      : "측정된 공부 기록이 없습니다.";

  const goalSeconds = Math.max(
    0,
    Number(data.daily_goal_seconds) || 28800,
  );

  const goalHours = Math.floor(
    goalSeconds / 3600,
  );

  const goalMinutes = Math.floor(
    (goalSeconds % 3600) / 60,
  );

  goalHoursDOM.value = goalHours;
  goalMinutesDOM.value = goalMinutes;
}

// =========================================================
// 프로필 불러오기
// =========================================================

async function loadProfile() {
  hideProfileMessage();

  try {
    const result = await apiRequest(
      "/api/profile",
    );

    renderProfile(result);

    if (result.force_password_change) {
      showProfileEditMessage(
        "임시 비밀번호로 로그인했습니다. 아래에서 새 비밀번호를 설정해 주세요.",
        true,
      );
      profileCurrentPasswordDOM?.focus();
    }
  } catch (error) {
    console.error(error);
    showProfileMessage(error.message);
  }
}

// =========================================================
// 프로필 수정
// =========================================================

async function saveProfileEdit(event) {
  event.preventDefault();
  hideProfileEditMessage();

  const name = profileEditNameDOM.value.trim();
  const studentId =
    profileEditStudentIdDOM.value.trim();

  const currentPassword =
    profileCurrentPasswordDOM.value;
  const newPassword =
    profileNewPasswordDOM.value;
  const newPasswordConfirm =
    profileNewPasswordConfirmDOM.value;

  if (!name) {
    showProfileEditMessage(
      "이름을 입력해주세요.",
      true,
    );
    profileEditNameDOM.focus();
    return;
  }

  if (name.length > 20) {
    showProfileEditMessage(
      "이름은 20자 이하로 입력해주세요.",
      true,
    );
    return;
  }

  if (!/^\d{5}$/.test(studentId)) {
    showProfileEditMessage(
      "학번 5자리를 정확하게 입력해주세요.",
      true,
    );
    profileEditStudentIdDOM.focus();
    return;
  }

  const hasPasswordInput =
    currentPassword.length > 0 ||
    newPassword.length > 0 ||
    newPasswordConfirm.length > 0;

  if (hasPasswordInput) {
    if (!currentPassword) {
      showProfileEditMessage(
        "현재 비밀번호를 입력해주세요.",
        true,
      );
      profileCurrentPasswordDOM.focus();
      return;
    }

    if (newPassword.length < 6) {
      showProfileEditMessage(
        "새 비밀번호는 6자 이상이어야 합니다.",
        true,
      );
      profileNewPasswordDOM.focus();
      return;
    }

    if (newPassword !== newPasswordConfirm) {
      showProfileEditMessage(
        "새 비밀번호 확인이 일치하지 않습니다.",
        true,
      );
      profileNewPasswordConfirmDOM.focus();
      return;
    }
  }

  setProfileEditLoading(true);

  try {
    const result = await apiRequest(
      "/api/profile",
      {
        method: "PATCH",
        body: {
          name,
          student_id: studentId,
          current_password: currentPassword,
          new_password: newPassword,
          new_password_confirm:
            newPasswordConfirm,
        },
      },
    );

    showProfileEditMessage(
      result.message ||
        "프로필이 수정되었습니다.",
    );

    profileEditStatusBadgeDOM.textContent =
      "저장 완료";

    profileCurrentPasswordDOM.value = "";
    profileNewPasswordDOM.value = "";
    profileNewPasswordConfirmDOM.value = "";

    await loadProfile();
  } catch (error) {
    console.error(error);
    showProfileEditMessage(
      error.message,
      true,
    );
    profileEditStatusBadgeDOM.textContent =
      "수정 실패";
  } finally {
    setProfileEditLoading(false);
  }
}

// =========================================================
// 목표 저장
// =========================================================

async function saveDailyGoal(event) {
  event.preventDefault();

  hideGoalMessage();

  const hours = Number(goalHoursDOM.value);
  const minutes = Number(goalMinutesDOM.value);

  if (
    !Number.isInteger(hours) ||
    hours < 0 ||
    hours > 23
  ) {
    showGoalMessage(
      "시간은 0부터 23까지 입력해주세요.",
      true,
    );
    return;
  }

  if (
    !Number.isInteger(minutes) ||
    minutes < 0 ||
    minutes > 59
  ) {
    showGoalMessage(
      "분은 0부터 59까지 입력해주세요.",
      true,
    );
    return;
  }

  const goalSeconds =
    hours * 3600 + minutes * 60;

  if (goalSeconds < 1800) {
    showGoalMessage(
      "목표시간은 최소 30분 이상이어야 합니다.",
      true,
    );
    return;
  }

  setGoalLoading(true);

  try {
    const result = await apiRequest(
      "/api/profile/goal",
      {
        method: "PATCH",
        body: {
          daily_goal_seconds: goalSeconds,
        },
      },
    );

    showGoalMessage(
      result.message ||
        "목표 공부시간을 저장했습니다.",
    );

    goalStatusBadgeDOM.textContent =
      "저장 완료";

    await loadProfile();
  } catch (error) {
    console.error(error);

    showGoalMessage(
      error.message,
      true,
    );
  } finally {
    setGoalLoading(false);
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

profileEditFormDOM?.addEventListener(
  "submit",
  saveProfileEdit,
);

goalFormDOM.addEventListener(
  "submit",
  saveDailyGoal,
);

logoutButtonDOM?.addEventListener(
  "click",
  logout,
);

profileLogoutButtonDOM?.addEventListener(
  "click",
  logout,
);

mobileLogoutButtonDOM?.addEventListener(
  "click",
  logout,
);

// =========================================================
// 실행
// =========================================================

loadProfile();