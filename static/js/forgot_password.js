"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("forgotPasswordForm");
  const nameInput = document.getElementById("name");
  const studentIdInput = document.getElementById("studentId");
  const usernameInput = document.getElementById("username");
  const message = document.getElementById("forgotPasswordMessage");
  const button = document.getElementById("forgotPasswordButton");
  const resultBox = document.getElementById("temporaryPasswordBox");
  const passwordValue = document.getElementById("temporaryPasswordValue");
  const copyButton = document.getElementById("copyPasswordButton");

  function showMessage(text, isError = true) {
    message.textContent = text;
    message.hidden = false;
    message.style.color = isError ? "#d8442f" : "#18864b";
  }

  function clearResult() {
    message.hidden = true;
    resultBox.hidden = true;
    passwordValue.textContent = "";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearResult();

    const name = nameInput.value.trim();
    const studentId = studentIdInput.value.trim();
    const username = usernameInput.value.trim();

    if (!name || !/^\d{5}$/.test(studentId) || !username) {
      showMessage("이름, 학번 5자리, 아이디를 정확하게 입력해 주세요.");
      return;
    }

    button.disabled = true;
    button.textContent = "발급 중...";

    try {
      const response = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          name,
          student_id: studentId,
          username,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "임시 비밀번호 발급에 실패했습니다.");
      }

      showMessage(result.message, false);
      passwordValue.textContent = result.temporary_password;
      resultBox.hidden = false;
    } catch (error) {
      showMessage(error.message || "오류가 발생했습니다.");
    } finally {
      button.disabled = false;
      button.textContent = "임시 비밀번호 발급";
    }
  });

  copyButton.addEventListener("click", async () => {
    const value = passwordValue.textContent;
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      copyButton.textContent = "복사됨";
      setTimeout(() => {
        copyButton.textContent = "복사";
      }, 1200);
    } catch {
      showMessage("복사하지 못했습니다. 직접 선택해서 복사해 주세요.");
    }
  });
});
