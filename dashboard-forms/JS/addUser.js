/**
 * addUser.js - Register a new user
 *
 * Submits the Add User form to POST /users/register.
 * On success, redirects back to the correct User Management page by role.
 */

"use strict";

const API_BASE = window.API_URL || "https://kgl-project-3g6j.onrender.com";
const params = new URLSearchParams(window.location.search);
const editUserId = params.get("userId");
const isEditMode = !!editUserId;

function getToken() {
  return localStorage.getItem("token");
}

function decodeToken(token) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

// Return user-management route based on logged-in role.
function getUserManagementPath(callerRole) {
  if (callerRole === "Director") {
    return "../DirectorsDashboard/usermanegementDash.html";
  }
  return "../html/usermanagement.html";
}

function showAlert(message, type) {
  var box = document.getElementById("alert-box");
  box.className = "au-alert " + (type || "error");
  box.textContent = message;
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function clearAlert() {
  var box = document.getElementById("alert-box");
  box.className = "au-alert hidden";
  box.textContent = "";
}

function getFormTitle() {
  return document.querySelector(".form-header h2");
}

function getFormSubtitle() {
  return document.querySelector(".form-header p");
}

function setFormMode() {
  var title = getFormTitle();
  var subtitle = getFormSubtitle();
  var submitBtn = document.getElementById("submit-btn");
  var passwordInput = document.getElementById("password");

  if (!isEditMode) {
    return;
  }

  if (title) {
    title.textContent = "Update User";
  }

  if (subtitle) {
    subtitle.textContent = "Update staff member details";
  }

  if (submitBtn) {
    submitBtn.textContent = "Update User";
  }

  if (passwordInput) {
    passwordInput.required = false;
    passwordInput.placeholder = "Leave blank to keep current password";
  }
}

function normalizeUserPayload(data) {
  if (data && data.data) {
    return data.data;
  }

  if (data && data.user) {
    return data.user;
  }

  return data;
}

function fillForm(user, callerRole, callerBranch) {
  document.getElementById("name").value = user.name || "";
  document.getElementById("email").value = user.email || "";
  document.getElementById("phone").value = user.phone || "";
  document.getElementById("password").value = "";

  var roleSelect = document.getElementById("role");
  var branchSelect = document.getElementById("branch");

  if (user.role) {
    roleSelect.value = user.role;
  }

  if (callerRole === "Manager") {
    branchSelect.value = callerBranch || user.branch || "";
  } else if (user.branch) {
    branchSelect.value = user.branch;
  }
}

async function loadUserForEdit(token, callerRole, callerBranch) {
  clearAlert();

  try {
    var response = await fetch(API_BASE + "/users/" + encodeURIComponent(editUserId), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      }
    });

    var data = await response.json();
    if (!response.ok) {
      showAlert(data.message || "Failed to load user details.", "error");
      return;
    }

    fillForm(normalizeUserPayload(data), callerRole, callerBranch);
  } catch {
    showAlert("Network error. Please check your connection.", "error");
  }
}

async function handleSubmit(e) {
  e.preventDefault();
  clearAlert();

  var token = getToken();
  if (!token) {
    window.location.href = "../../loginform/html/login.html";
    return;
  }

  var name = document.getElementById("name").value.trim();
  var email = document.getElementById("email").value.trim();
  var password = document.getElementById("password").value;
  var phone = document.getElementById("phone").value.trim();
  var role = document.getElementById("role").value;
  var branch = document.getElementById("branch").value;
  var decoded = decodeToken(token);
  var callerRole = decoded ? decoded.role : "";
  var callerBranch = decoded ? decoded.branch : "";

  if (!name || !email || !role) {
    showAlert("Name, email and role are required.", "error");
    return;
  }

  if (!isEditMode && !password) {
    showAlert("Password is required when creating a user.", "error");
    return;
  }

  if (password && password.length < 6) {
    showAlert("Password must be at least 6 characters.", "error");
    return;
  }

  // Managers can only create Sales-agents.
  if (callerRole === "Manager" && role !== "Sales-agent") {
    showAlert("Managers can only create Sales-agents.", "error");
    return;
  }

  // Directors can only create Managers.
  if (callerRole === "Director" && role !== "Manager") {
    showAlert("Directors can only create Managers.", "error");
    return;
  }

  // Managers cannot choose another branch.
  if (callerRole === "Manager") {
    branch = callerBranch || "";
    if (!branch) {
      showAlert("Your account has no branch assigned. Contact a Director.", "error");
      return;
    }
  }

  // Directors must set branch when creating managers.
  if (callerRole === "Director" && !branch) {
    showAlert("Please select a branch for the new Manager.", "error");
    return;
  }

  var payload = { name: name, email: email, role: role };
  if (branch) payload.branch = branch;
  if (phone) payload.phone = phone;
  if (password) payload.password = password;

  var btn = document.getElementById("submit-btn");
  btn.disabled = true;
  btn.textContent = isEditMode ? "Updating..." : "Registering...";

  try {
    var endpoint = isEditMode
      ? API_BASE + "/users/" + encodeURIComponent(editUserId)
      : API_BASE + "/users/register";
    var method = isEditMode ? "PUT" : "POST";

    var res = await fetch(endpoint, {
      method: method,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify(payload)
    });
    var data = await res.json();

    if (!res.ok) {
      showAlert(data.message || "Failed to save user.", "error");
      return;
    }

    showAlert(
      isEditMode
        ? "User updated successfully! Redirecting..."
        : "User registered successfully! Redirecting...",
      "success"
    );
    setTimeout(function () {
      window.location.href = getUserManagementPath(callerRole);
    }, 1500);
  } catch {
    showAlert("Network error. Please check your connection.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = isEditMode ? "Update User" : "Register User";
  }
}

document.addEventListener("DOMContentLoaded", function () {
  var token = getToken();
  if (!token) {
    window.location.href = "../../loginform/html/login.html";
    return;
  }

  var decoded = decodeToken(token);
  if (!decoded) {
    window.location.href = "../../loginform/html/login.html";
    return;
  }

  var roleSelect = document.getElementById("role");
  var branchSelect = document.getElementById("branch");
  var callerRole = decoded.role;
  var callerBranch = decoded.branch || "";

  setFormMode();

  // Fix Back link destination by role (Director vs Manager).
  var backLink = document.querySelector(".back-link");
  if (backLink) {
    backLink.setAttribute("href", getUserManagementPath(callerRole));
  }

  if (callerRole === "Manager") {
    roleSelect.innerHTML = '<option value="Sales-agent" selected>Sales-agent</option>';
    roleSelect.disabled = true;

    branchSelect.innerHTML =
      '<option value="' + callerBranch + '" selected>' + callerBranch + "</option>";
    branchSelect.disabled = true;
  } else if (callerRole === "Director") {
    roleSelect.innerHTML = '<option value="Manager" selected>Manager</option>';
    roleSelect.disabled = true;
    branchSelect.disabled = false;
  } else {
    showAlert("Access denied: only Managers and Directors can add users.", "error");
    document.getElementById("submit-btn").disabled = true;
  }

  if (isEditMode) {
    loadUserForEdit(token, callerRole, callerBranch);
  }

  document.getElementById("addUserForm").addEventListener("submit", handleSubmit);
});

