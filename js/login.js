document.addEventListener("DOMContentLoaded", () => {
    console.log("login.js 연결 성공");

    const form =
        document.getElementById("loginForm");

    if (!form) {
        console.error(
            "loginForm을 찾을 수 없습니다."
        );
        return;
    }

    const usernameInput =
        document.getElementById("username");

    const passwordInput =
        document.getElementById("password");

    const rememberInput =
        document.getElementById("remember");

    const messageElement =
        document.getElementById("loginMessage");

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
            ? "로그인 중..."
            : "로그인";
    };


    form.addEventListener(
        "submit",
        async (event) => {
            event.preventDefault();

            clearMessage();

            const username =
                usernameInput?.value.trim() || "";

            const password =
                passwordInput?.value || "";

            const remember =
                rememberInput?.checked || false;

            if (!username) {
                showMessage(
                    "아이디를 입력해 주세요."
                );

                usernameInput?.focus();
                return;
            }

            if (!password) {
                showMessage(
                    "비밀번호를 입력해 주세요."
                );

                passwordInput?.focus();
                return;
            }

            setLoading(true);

            try {
                const response = await fetch(
                    "/login",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        credentials: "same-origin",

                        body: JSON.stringify({
                            username,
                            password,
                            remember
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
                        || "로그인에 실패했습니다."
                    );
                }

                showMessage(
                    result.message,
                    "success"
                );

                window.location.href =
                    result.redirect || "/";

            } catch (error) {
                console.error(
                    "로그인 오류:",
                    error
                );

                showMessage(
                    error.message
                    || "로그인 처리 중 오류가 발생했습니다."
                );

            } finally {
                setLoading(false);
            }
        }
    );
});