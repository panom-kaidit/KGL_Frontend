
// Get form and inputs
const form = document.getElementById("form-box");
const userMail = document.getElementById("email");
const passCode = document.getElementById("passcode");
const messageBox = document.getElementById("login-message");
const API_URL = window.API_URL || "https://kgl-project-3g6j.onrender.com";

function showMessage(text, type) {
    messageBox.innerText = text;
    messageBox.className = `login-message ${type}`;
}

function clearMessage() {
    messageBox.innerText = "";
    messageBox.className = "login-message";
}

async function readJsonSafely(response) {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
        return null;
    }

    try {
        return await response.json();
    } catch {
        return null;
    }
}

function getLoginErrorMessage(response, body) {
    if (body && typeof body.message === "string" && body.message.trim()) {
        return body.message;
    }

    if (response.status === 403) {
        return "Access denied.";
    }

    if (response.status >= 500) {
        return "Server error. Please try again later.";
    }

    return "Invalid email or password";
}

// Function to decode JWT token
function decodeToken(token) {
    try {
        const payload = token.split('.')[1];
        const decoded = JSON.parse(atob(payload));
        return decoded;
    } catch (error) {
        console.error("Failed to decode token:", error);
        return null;
    }
}
form.addEventListener("submit", async function (event) {
    event.preventDefault();
    clearMessage();

    const email = userMail.value.trim();
    const password = passCode.value.trim();

    try {
        const response = await fetch(`${API_URL}/users/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email: email,
                password: password
            })
        });

        const data = await readJsonSafely(response);

        // If login failed
        if (!response.ok) {
            showMessage(getLoginErrorMessage(response, data), "error");
            return;
        }

        if (!data || !data.token) {
            showMessage("Server error. Please try again later.", "error");
            return;
        }

        // Store token
        localStorage.setItem("token", data.token);

        // Extract role and other info from token
        const decodedToken = decodeToken(data.token);
        let userRole = decodedToken ? decodedToken.role : null;
        let userName = decodedToken ? decodedToken.name : null;

        // Store role, name, and branch
        // FIXED (LOGIC-04): Previously made a second GET /users/:id request just to
        // read the branch, which is already present in the JWT payload. Removed the
        // extra round-trip; branch is now read directly from the decoded token.
        if (userRole) localStorage.setItem("userRole", userRole);
        if (userName) localStorage.setItem("userName", userName);
        if (decodedToken && decodedToken.branch) {
          localStorage.setItem("userBranch", decodedToken.branch);
        }

        // Redirect based on user role
        let dashboardUrl = null;

        if (userRole === "Sales-agent") {
            dashboardUrl = "../../dashboard-forms/html/sellersDashboard.html";
        } else if (userRole === "Manager") {
            dashboardUrl = "../../dashboard-forms/html/managersDashboard.html";
        } else if (userRole === "Director") {
            dashboardUrl = "../../dashboard-forms/DirectorsDashboard/directorsDashboard.html";
        } else {
            showMessage("Unknown user role: " + userRole + ". Please contact support.", "error");
            console.error("Unknown role:", userRole);
            return;
        }

        showMessage("Login successful. Redirecting...", "success");
        setTimeout(() => {
            window.location.href = dashboardUrl;
        }, 1500);
    

        // If backend returns ONLY token:
        // For now redirect to a general dashboard
        // window.location.href = "../../dashboard-forms/html/dashboard.html";

    } catch (error) {
        console.error("Error:", error);
        showMessage("Network error. Please try again.", "error");
    }
});
