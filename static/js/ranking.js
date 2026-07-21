"use strict";

// =========================================================
// DOM
// =========================================================

const rankingPeriodDOM = document.getElementById(
  "rankingPeriod",
);

const rankingMessageDOM = document.getElementById(
  "rankingMessage",
);

const rankingTabs = document.querySelectorAll(
  ".ranking-tab",
);

const personalRankingPanelDOM = document.getElementById(
  "personalRankingPanel",
);

const classRankingPanelDOM = document.getElementById(
  "classRankingPanel",
);

const personalRankingListDOM = document.getElementById(
  "personalRankingList",
);

const classRankingListDOM = document.getElementById(
  "classRankingList",
);

const personalRankingCountDOM = document.getElementById(
  "personalRankingCount",
);

const classRankingCountDOM = document.getElementById(
  "classRankingCount",
);

const podiumFirstDOM = document.getElementById(
  "podiumFirst",
);

const podiumSecondDOM = document.getElementById(
  "podiumSecond",
);

const podiumThirdDOM = document.getElementById(
  "podiumThird",
);

const myRankDOM = document.getElementById("myRank");

const myRankingNameDOM = document.getElementById(
  "myRankingName",
);

const myRankingInfoDOM = document.getElementById(
  "myRankingInfo",
);

const myRankingTimeDOM = document.getElementById(
  "myRankingTime",
);

const myRankingAvatarDOM = document.getElementById(
  "myRankingAvatar",
);

const logoutButton = document.getElementById(
  "logoutButton",
);

const mobileLogoutButton = document.getElementById(
  "mobileLogoutButton",
);

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
        "랭킹을 불러오지 못했습니다.",
    );
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

function showMessage(message) {
  rankingMessageDOM.textContent = message;
  rankingMessageDOM.hidden = false;
}

function hideMessage() {
  rankingMessageDOM.hidden = true;
  rankingMessageDOM.textContent = "";
}

// =========================================================
// 랭킹 불러오기
// =========================================================

async function loadRanking() {
  hideMessage();

  personalRankingListDOM.innerHTML = `
    <p class="empty-message">
      개인 랭킹을 불러오는 중입니다.
    </p>
  `;

  classRankingListDOM.innerHTML = `
    <p class="empty-message">
      반 랭킹을 불러오는 중입니다.
    </p>
  `;

  const period = rankingPeriodDOM.value;

  try {
    const result = await apiRequest(
      `/api/ranking?period=${encodeURIComponent(period)}`,
    );

    renderMyRanking(result.my_ranking || {});
    renderPersonalRanking(result.personal_ranking || []);
    renderClassRanking(result.class_ranking || []);
  } catch (error) {
    console.error(error);
    showMessage(error.message);
  }
}

// =========================================================
// 내 순위
// =========================================================

function renderMyRanking(data) {
  const userName = data.name || "사용자";

  myRankDOM.textContent = data.rank
    ? `${data.rank}위`
    : "-";

  myRankingNameDOM.textContent = userName;

  myRankingAvatarDOM.textContent =
    getInitial(userName);

  const information = [
    data.student_number,
    data.class_name,
  ].filter(Boolean);

  myRankingInfoDOM.textContent =
    information.length > 0
      ? information.join(" · ")
      : "참가자 정보";

  myRankingTimeDOM.textContent =
    formatSeconds(data.study_seconds);
}

// =========================================================
// 개인 랭킹
// =========================================================

function renderPersonalRanking(ranking) {
  personalRankingCountDOM.textContent =
    `${ranking.length}명`;

  renderPodium(ranking);

  personalRankingListDOM.innerHTML = "";

  if (ranking.length === 0) {
    personalRankingListDOM.innerHTML = `
      <p class="empty-message">
        표시할 개인 랭킹이 없습니다.
      </p>
    `;

    return;
  }

  ranking.forEach((user, index) => {
    const rank = user.rank || index + 1;

    const row = document.createElement("div");
    row.className = "ranking-row";

    if (user.is_me) {
      row.classList.add("is-me");
    }

    row.innerHTML = `
      <div class="ranking-number">
        ${escapeHTML(rank)}
      </div>

      <div class="ranking-user">
        <div class="ranking-avatar">
          ${escapeHTML(getInitial(user.name))}
        </div>

        <div class="ranking-user-info">
          <strong>
            ${escapeHTML(user.name || "사용자")}
            ${user.is_me ? '<span class="me-badge">나</span>' : ""}
          </strong>

          <span>
            ${escapeHTML(
              [user.student_number, user.class_name]
                .filter(Boolean)
                .join(" · "),
            )}
          </span>
        </div>
      </div>

      <strong class="ranking-study-time">
        ${formatSeconds(user.study_seconds)}
      </strong>
    `;

    personalRankingListDOM.appendChild(row);
  });
}

function renderPodium(ranking) {
  renderPodiumItem(
    podiumFirstDOM,
    ranking[0],
    1,
  );

  renderPodiumItem(
    podiumSecondDOM,
    ranking[1],
    2,
  );

  renderPodiumItem(
    podiumThirdDOM,
    ranking[2],
    3,
  );
}

function renderPodiumItem(element, user, rank) {
  if (!user) {
    element.innerHTML = `
      <div class="podium-medal">
        ${rank}
      </div>

      <div class="ranking-avatar podium-avatar">
        -
      </div>

      <strong>아직 없음</strong>

      <span>00:00:00</span>
    `;

    return;
  }

  const medals = {
    1: "🥇",
    2: "🥈",
    3: "🥉",
  };

  element.innerHTML = `
    <div class="podium-medal">
      ${medals[rank]}
    </div>

    <div class="ranking-avatar podium-avatar">
      ${escapeHTML(getInitial(user.name))}
    </div>

    <strong>
      ${escapeHTML(user.name || "사용자")}
    </strong>

    <span>
      ${formatSeconds(user.study_seconds)}
    </span>

    <small>
      ${escapeHTML(user.class_name || "")}
    </small>
  `;
}

// =========================================================
// 반 랭킹
// =========================================================

function renderClassRanking(ranking) {
  classRankingCountDOM.textContent =
    `${ranking.length}개 반`;

  classRankingListDOM.innerHTML = "";

  if (ranking.length === 0) {
    classRankingListDOM.innerHTML = `
      <p class="empty-message">
        표시할 반 랭킹이 없습니다.
      </p>
    `;

    return;
  }

  ranking.forEach((classData, index) => {
    const rank = classData.rank || index + 1;

    const row = document.createElement("div");
    row.className = "ranking-row class-ranking-row";

    if (classData.is_my_class) {
      row.classList.add("is-me");
    }

    row.innerHTML = `
      <div class="ranking-number">
        ${escapeHTML(rank)}
      </div>

      <div class="ranking-user">
        <div class="ranking-avatar class-avatar">
          ${escapeHTML(rank)}
        </div>

        <div class="ranking-user-info">
          <strong>
            ${escapeHTML(classData.class_name || "학급")}
            ${
              classData.is_my_class
                ? '<span class="me-badge">우리 반</span>'
                : ""
            }
          </strong>

          <span>
            ${escapeHTML(classData.member_count || 0)}명 참여
          </span>
        </div>
      </div>

      <div class="class-ranking-time">
        <strong>
          ${formatSeconds(classData.total_study_seconds)}
        </strong>

        <span>
          평균 ${formatSeconds(classData.average_study_seconds)}
        </span>
      </div>
    `;

    classRankingListDOM.appendChild(row);
  });
}

// =========================================================
// 탭
// =========================================================

function changeRankingTab(tabName) {
  rankingTabs.forEach((tab) => {
    tab.classList.toggle(
      "active",
      tab.dataset.rankingTab === tabName,
    );
  });

  personalRankingPanelDOM.hidden =
    tabName !== "personal";

  classRankingPanelDOM.hidden =
    tabName !== "class";
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

rankingPeriodDOM.addEventListener(
  "change",
  loadRanking,
);

rankingTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    changeRankingTab(tab.dataset.rankingTab);
  });
});

logoutButton?.addEventListener(
  "click",
  logout,
);

mobileLogoutButton?.addEventListener(
  "click",
  logout,
);

// =========================================================
// 실행
// =========================================================

loadRanking();