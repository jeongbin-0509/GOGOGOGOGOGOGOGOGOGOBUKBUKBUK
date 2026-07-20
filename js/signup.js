document.addEventListener("DOMContentLoaded", () => {
    console.log("signup.js 연결 성공");

    const form =
        document.getElementById("signupForm");

    if (!form) {
        console.error(
            "signupForm을 찾을 수 없습니다."
        );
        return;
    }

    const nameInput =
        document.getElementById("name");

    const studentIdInput =
        document.getElementById("student_id");

    const usernameInput =
        document.getElementById("username");

    const passwordInput =
        document.getElementById("password");

    const passwordConfirmInput =
        document.getElementById(
            "passwordConfirm"
        )
        || document.getElementById(
            "password_confirm"
        );

    const messageElement =
        document.getElementById(
            "signupMessage"
        );

    const submitButton =
        form.querySelector(
            'button[type="submit"]'
        );


    const showMessage = (
        message,
        type = "error"
    ) => {
        if (!messageElement) {
            alert(message);
            return;
        }

        messageElement.textContent = message;
        messageElement.hidden = false;
        messageElement.dataset.type = type;

        if (type === "success") {
            messageElement.style.color = "#18864b";
        } else {
            messageElement.style.color = "#d8442f";
        }
    };


    const clearMessage = () => {
        if (!messageElement) {
            return;
        }

        messageElement.textContent = "";
        messageElement.hidden = true;
    };


    const setLoading = (loading) => {
        if (!submitButton) {
            return;
        }

        submitButton.disabled = loading;

        submitButton.textContent = loading
            ? "가입 중..."
            : "회원가입";
    };


    form.addEventListener(
        "submit",
        async (event) => {
            event.preventDefault();

            clearMessage();

            const name =
                nameInput?.value.trim() || "";

            const studentId =
                studentIdInput?.value.trim() || "";

            const username =
                usernameInput?.value
                    .trim()
                    .toLowerCase() || "";

            const password =
                passwordInput?.value || "";

            const passwordConfirm =
                passwordConfirmInput?.value || "";

            if (!name) {
                showMessage(
                    "이름을 입력해 주세요."
                );

                nameInput?.focus();
                return;
            }

            if (!/^\d{5}$/.test(studentId)) {
                showMessage(
                    "학번 5자리를 정확하게 입력해 주세요."
                );

                studentIdInput?.focus();
                return;
            }

            if (username.length < 4) {
                showMessage(
                    "아이디는 4자 이상이어야 합니다."
                );

                usernameInput?.focus();
                return;
            }

            if (
                !/^[a-zA-Z0-9_]+$/.test(
                    username
                )
            ) {
                showMessage(
                    "아이디는 영문, 숫자, 밑줄만 사용할 수 있습니다."
                );

                usernameInput?.focus();
                return;
            }

            if (password.length < 6) {
                showMessage(
                    "비밀번호는 6자 이상이어야 합니다."
                );

                passwordInput?.focus();
                return;
            }

            if (
                password
                !== passwordConfirm
            ) {
                showMessage(
                    "비밀번호 확인이 일치하지 않습니다."
                );

                passwordConfirmInput?.focus();
                return;
            }

            setLoading(true);

            try {
                const response = await fetch(
                    "/signup",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        credentials: "same-origin",

                        body: JSON.stringify({
                            name,
                            student_id: studentId,
                            username,
                            password,
                            password_confirm:
                                passwordConfirm
                        })
                    }
                );

                const contentType =
                    response.headers.get(
                        "content-type"
                    ) || "";

                if (
                    !contentType.includes(
                        "application/json"
                    )
                ) {
                    const responseText =
                        await response.text();

                    console.error(
                        "JSON이 아닌 응답:",
                        response.status,
                        responseText
                    );

                    throw new Error(
                        `서버 응답 오류 (${response.status})`
                    );
                }

                const result =
                    await response.json();

                if (
                    !response.ok
                    || !result.success
                ) {
                    throw new Error(
                        result.message
                        || "회원가입에 실패했습니다."
                    );
                }

                showMessage(
                    result.message,
                    "success"
                );

                setTimeout(() => {
                    window.location.href =
                        result.redirect
                        || "/login";
                }, 500);

            } catch (error) {
                console.error(
                    "회원가입 오류:",
                    error
                );

                showMessage(
                    error.message
                    || "회원가입 처리 중 오류가 발생했습니다."
                );

            } finally {
                setLoading(false);
            }
        }
    );
});