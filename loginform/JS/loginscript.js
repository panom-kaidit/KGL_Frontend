
// Get form and inputs
const form = document.getElementById("form-box");
const userMail = document.getElementById("email");
const passCode = document.getElementById("passcode");
const API_URL = window.API_URL || "https://kgl-project-3g6j.onrender.com";


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

        const data = await response.json();

        // If login failed
        if (!response.ok) {
            alert(data.message || "Login failed");
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

        alert("Login successful!");

        // Redirect based on user role
        if (userRole === "Sales-agent") {
            window.location.href = "../../dashboard-forms/html/sellersDashboard.html";
        } else if (userRole === "Manager") {
            window.location.href = "../../dashboard-forms/html/managersDashboard.html";
        } else if (userRole === "Director") {
            window.location.href = "../../dashboard-forms/DirectorsDashboard/directorsDashboard.html";
        } else {
            alert("Unknown user role: " + userRole + ". Please contact support.");
            console.error("Unknown role:", userRole);
        }
    

        // If backend returns ONLY token:
        // For now redirect to a general dashboard
        // window.location.href = "../../dashboard-forms/html/dashboard.html";

    } catch (error) {
        console.error("Error:", error);
        alert("Something went wrong. Check server.");
    }
});
