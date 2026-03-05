/**
 * addUser.js - Register a new user
 *
 * Submits the Add User form to POST /users/register.
 * On success, redirects back to the correct User Management page by role.
 */

"use strict";

const API_BASE = window.API_URL || "https://kgl-project-3g6j.onrender.com";

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
    return "/Dashbord forms/DirectorsDashboard/usermanegementDash.html";
  }
  return "/Dashbord forms/html/usermanagement.html";
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

async function handleSubmit(e) {
  e.preventDefault();
  clearAlert();

  var token = getToken();
  if (!token) {
    window.location.href = "/loginform/html/login.html";
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

  if (!name || !email || !password || !role) {
    showAlert("Name, email, password and role are required.", "error");
    return;
  }

  if (password.length < 6) {
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

  var payload = { name: name, email: email, password: password, role: role };
  if (branch) payload.branch = branch;
  if (phone) payload.phone = phone;

  var btn = document.getElementById("submit-btn");
  btn.disabled = true;
  btn.textContent = "Registering...";

  try {
    var res = await fetch(API_BASE + "/users/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify(payload)
    });
    var data = await res.json();

    if (!res.ok) {
      showAlert(data.message || "Failed to register user.", "error");
      return;
    }

    showAlert("User registered successfully! Redirecting...", "success");
    setTimeout(function () {
      window.location.href = getUserManagementPath(callerRole);
    }, 1500);
  } catch {
    showAlert("Network error. Please check your connection.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Register User";
  }
}

document.addEventListener("DOMContentLoaded", function () {
  var token = getToken();
  if (!token) {
    window.location.href = "/loginform/html/login.html";
    return;
  }

  var decoded = decodeToken(token);
  if (!decoded) {
    window.location.href = "/loginform/html/login.html";
    return;
  }

  var roleSelect = document.getElementById("role");
  var branchSelect = document.getElementById("branch");
  var callerRole = decoded.role;
  var callerBranch = decoded.branch || "";

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

  document.getElementById("addUserForm").addEventListener("submit", handleSubmit);
});

