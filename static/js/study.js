(() => {
  const display = document.querySelector('#timerDisplay');
  if (!display) return;

  const startButton = document.querySelector('#startButton');
  const stopButton = document.querySelector('#stopButton');
  const status = document.querySelector('#studyStatus');
  const notice = document.querySelector('#timerNotice');
  const progressValue = document.querySelector('#progressValue');
  const progressFill = document.querySelector('#progressFill');
  const manualButton = document.querySelector('#manualRecordButton');
  const goalButton = document.querySelector('#goalButton');
  const mobileGoalButton = document.querySelector('#mobileGoalButton');
  const backdrop = document.querySelector('#modalBackdrop');
  const modalTitle = document.querySelector('#modalTitle');
  const modalBody = document.querySelector('#modalBody');
  const modalCancel = document.querySelector('#modalCancel');
  const modalConfirm = document.querySelector('#modalConfirm');

  const baseSeconds = Number(display.dataset.baseSeconds || 0);
  let sessionSeconds = 0;
  let state = 'idle';
  let startedAt = null;
  let intervalId = null;
  let lastTick = null;
  let modalAction = null;

  const formatHms = (seconds) => {
    const safe = Math.max(0, Math.floor(seconds));
    const hours = String(Math.floor(safe / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((safe % 3600) / 60)).padStart(2, '0');
    const secs = String(safe % 60).padStart(2, '0');
    return `${hours}:${minutes}:${secs}`;
  };

  const updateDisplay = () => {
    const total = baseSeconds + sessionSeconds;
    display.textContent = formatHms(total);
    const goal = Number(window.STUDY_CONFIG.goalSeconds || 28800);
    const percentage = Math.min(100, Math.round(total / goal * 100));
    progressValue.textContent = `${percentage}%`;
    progressFill.style.width = `${percentage}%`;
  };

  const setState = (next) => {
    state = next;
    status.className = 'badge';
    if (next === 'running') {
      status.textContent = '공부중';
      status.classList.add('badge-success');
      startButton.textContent = '공부 중';
      startButton.disabled = true;
      stopButton.disabled = false;
      notice.textContent = '현재 집중 시간이 기록되고 있습니다.';
    } else if (next === 'paused') {
      status.textContent = '집중 중단';
      status.classList.add('badge-warning');
      startButton.textContent = '공부 계속하기';
      startButton.disabled = false;
      stopButton.disabled = false;
      notice.textContent = '탭을 벗어나 타이머가 멈췄습니다. 계속하기를 눌러 재개하세요.';
    } else {
      status.textContent = '대기중';
      status.classList.add('badge-idle');
      startButton.textContent = '공부 시작';
      startButton.disabled = false;
      stopButton.disabled = true;
      notice.textContent = '공부 시작 후 다른 탭이나 앱으로 이동하면 타이머가 자동 중단됩니다.';
    }
  };

  const tick = () => {
    const now = Date.now();
    if (lastTick !== null) sessionSeconds += Math.max(0, Math.floor((now - lastTick) / 1000));
    lastTick = now;
    updateDisplay();
  };

  const startTimer = () => {
    if (state === 'idle') {
      startedAt = new Date().toISOString();
      sessionSeconds = 0;
    }
    lastTick = Date.now();
    clearInterval(intervalId);
    intervalId = setInterval(tick, 1000);
    setState('running');
  };

  const pauseTimer = () => {
    if (state !== 'running') return;
    tick();
    clearInterval(intervalId);
    intervalId = null;
    lastTick = null;
    setState('paused');
  };

  const openModal = ({ title, body, confirmText = '저장', action }) => {
    modalTitle.textContent = title;
    modalBody.innerHTML = body;
    modalConfirm.textContent = confirmText;
    modalAction = action;
    backdrop.classList.remove('hidden');
    modalBody.querySelector('input')?.focus();
  };

  const closeModal = () => {
    backdrop.classList.add('hidden');
    modalAction = null;
  };

  const postJson = async (url, data) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(data)
    });
    const result = await response.json().catch(() => ({ok: false, message: '서버 응답을 읽지 못했습니다.'}));
    if (!response.ok || !result.ok) throw new Error(result.message || '저장에 실패했습니다.');
    return result;
  };

  startButton.addEventListener('click', startTimer);

  stopButton.addEventListener('click', () => {
    if (state === 'running') pauseTimer();
    if (sessionSeconds < 10) {
      alert('10초 이상 공부한 뒤 종료해 주세요.');
      return;
    }
    openModal({
      title: '공부 기록 저장',
      body: `<label class="input-label" for="subjectInput">공부한 과목</label>
             <input class="input" id="subjectInput" maxlength="30" placeholder="예: 수학">
             <p class="modal-summary">이번 집중 시간: <strong>${formatHms(sessionSeconds)}</strong></p>`,
      action: async () => {
        const subject = document.querySelector('#subjectInput').value.trim();
        if (!subject) throw new Error('공부한 과목을 입력해 주세요.');
        await postJson(window.STUDY_CONFIG.recordUrl, {
          subject,
          duration_seconds: sessionSeconds,
          started_at: startedAt,
          ended_at: new Date().toISOString()
        });
        location.reload();
      }
    });
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseTimer();
  });
  window.addEventListener('blur', pauseTimer);

  manualButton.addEventListener('click', () => {
    openModal({
      title: '공부 기록 직접 작성',
      body: `<label class="input-label" for="manualSubject">과목</label>
             <input class="input" id="manualSubject" maxlength="30" placeholder="예: 영어">
             <label class="input-label modal-label" for="manualMinutes">공부 시간(분)</label>
             <input class="input" id="manualMinutes" type="number" min="1" max="960" placeholder="예: 90">`,
      action: async () => {
        const subject = document.querySelector('#manualSubject').value.trim();
        const minutes = Number(document.querySelector('#manualMinutes').value);
        await postJson(window.STUDY_CONFIG.manualRecordUrl, {subject, minutes});
        location.reload();
      }
    });
  });

  const openGoalModal = () => {
    const current = Number(window.STUDY_CONFIG.goalSeconds || 28800) / 3600;
    openModal({
      title: '하루 목표 시간 설정',
      body: `<label class="input-label" for="goalHours">목표 시간(시간)</label>
             <input class="input" id="goalHours" type="number" min="0.5" max="16" step="0.5" value="${current}">`,
      action: async () => {
        const hours = Number(document.querySelector('#goalHours').value);
        await postJson(window.STUDY_CONFIG.goalUrl, {hours});
        location.reload();
      }
    });
  };

  goalButton?.addEventListener('click', openGoalModal);
  mobileGoalButton?.addEventListener('click', openGoalModal);
  modalCancel.addEventListener('click', closeModal);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) closeModal(); });
  modalConfirm.addEventListener('click', async () => {
    if (!modalAction) return;
    modalConfirm.disabled = true;
    try {
      await modalAction();
    } catch (error) {
      alert(error.message);
    } finally {
      modalConfirm.disabled = false;
    }
  });

  updateDisplay();
  setState('idle');
})();
