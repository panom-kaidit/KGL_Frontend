"use strict";

const API_BASE = window.API_URL || "https://kgl-project-3g6j.onrender.com";

let allUsers = [];
let currentSort = "az";

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

function showAlert(message, type) {
  const box = document.getElementById("alert-box");
  box.className = "um-alert " + (type || "error");
  box.textContent = message;
}

async function readJsonSafely(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function avatarLetter(name) {
  return (name || "?").charAt(0).toUpperCase();
}

function roleBadgeClass(role) {
  const map = {
    Manager: "role-manager",
    "Sales-agent": "role-sales-agent",
    Director: "role-director"
  };
  return map[role] || "role-default";
}

function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderTable(users) {
  const tbody = document.getElementById("usersTableBody");
  const noResults = document.getElementById("noResultsMessage");
  const countEl = document.getElementById("resultCount");

  if (!users.length) {
    tbody.innerHTML = "";
    noResults.style.display = "flex";
    countEl.textContent = "";
    return;
  }

  noResults.style.display = "none";
  countEl.textContent =
    "Showing " + users.length + " user" + (users.length !== 1 ? "s" : "");

  tbody.innerHTML = users
    .map(function (u, i) {
      return (
        "<tr>" +
        '<td class="row-num">' + (i + 1) + "</td>" +
        "<td>" +
        '<div class="user-name-cell">' +
        '<div class="avatar">' + avatarLetter(u.name) + "</div>" +
        "<span>" + escHtml(u.name || "-") + "</span>" +
        "</div>" +
        "</td>" +
        "<td>" + escHtml(u.email || "-") + "</td>" +
        "<td>" +
        '<span class="role-badge ' + roleBadgeClass(u.role) + '">' +
        escHtml(u.role || "-") +
        "</span>" +
        "</td>" +
        '<td><span class="branch-badge">' + escHtml(u.branch || "-") + "</span></td>" +
        "<td>" + escHtml(u.phone || "-") + "</td>" +
        '<td><div class="action-buttons">' +
        '<button class="edit-user" data-user-id="' + escHtml(u._id || "") + '">Edit</button>' +
        '<button class="delete-user" data-user-id="' + escHtml(u._id || "") + '">Delete</button>' +
        "</div></td>" +
        "</tr>"
      );
    })
    .join("");
}

function applyFilters() {
  const query = document.getElementById("searchInput").value.trim().toLowerCase();

  const filtered = allUsers.filter(function (u) {
    const haystack = (
      (u.name || "") +
      " " +
      (u.email || "") +
      " " +
      (u.role || "") +
      " " +
      (u.branch || "") +
      " " +
      (u.phone || "")
    ).toLowerCase();

    return haystack.indexOf(query) !== -1;
  });

  filtered.sort(function (a, b) {
    const nameA = (a.name || "").toLowerCase();
    const nameB = (b.name || "").toLowerCase();
    return currentSort === "az"
      ? nameA.localeCompare(nameB)
      : nameB.localeCompare(nameA);
  });

  renderTable(filtered);
}

async function loadBranchUsers() {
  const token = getToken();
  if (!token) {
    window.location.href = "../../loginform/html/login.html";
    return;
  }

  const decoded = decodeToken(token);
  if (!decoded || decoded.role !== "Manager") {
    showAlert("Access denied. This page is for Managers only.", "error");
    return;
  }

  try {
    const res = await fetch(API_BASE + "/users/branch", {
      headers: { Authorization: "Bearer " + token }
    });

    const body = await readJsonSafely(res);
    if (!res.ok) {
      showAlert((body && body.message) || "Failed to load users.", "error");
      document.getElementById("usersTableBody").innerHTML =
        '<tr><td colspan="7" class="text-center">Could not load users.</td></tr>';
      return;
    }

    allUsers = body.data || [];
    document.getElementById("branch-label").textContent =
      "Branch: " + body.branch + " - " + body.count + " user" + (body.count !== 1 ? "s" : "");
    applyFilters();
  } catch {
    showAlert("Network error. Please check your connection.", "error");
    document.getElementById("usersTableBody").innerHTML =
      '<tr><td colspan="7" class="text-center">Network error.</td></tr>';
  }
}

async function editUser(userId) {
  const user = allUsers.find(function (item) {
    return item._id === userId;
  });

  if (!user) {
    showAlert("User not found.", "error");
    return;
  }

  const name = window.prompt("Edit name:", user.name || "");
  if (name === null) return;

  const email = window.prompt("Edit email:", user.email || "");
  if (email === null) return;

  const phone = window.prompt("Edit phone:", user.phone || "");
  if (phone === null) return;

  try {
    const res = await fetch(API_BASE + "/users/" + encodeURIComponent(userId), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + getToken()
      },
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim()
      })
    });

    const body = await readJsonSafely(res);
    if (!res.ok) {
      showAlert((body && body.message) || "Failed to update user.", "error");
      return;
    }

    showAlert("User updated successfully.", "success");
    loadBranchUsers();
  } catch {
    showAlert("Network error. Please check your connection.", "error");
  }
}

async function deleteUser(userId) {
  if (!window.confirm("Are you sure you want to delete this user?")) {
    return;
  }

  try {
    const res = await fetch(API_BASE + "/users/" + encodeURIComponent(userId), {
      method: "DELETE",
      headers: { Authorization: "Bearer " + getToken() }
    });

    const body = await readJsonSafely(res);
    if (!res.ok) {
      showAlert((body && body.message) || "Failed to delete user.", "error");
      return;
    }

    showAlert("User deleted successfully.", "success");
    loadBranchUsers();
  } catch {
    showAlert("Network error. Please check your connection.", "error");
  }
}

document.addEventListener("DOMContentLoaded", function () {
  loadBranchUsers();

  const searchInput = document.getElementById("searchInput");
  const clearBtn = document.getElementById("clearSearch");

  searchInput.addEventListener("input", function () {
    clearBtn.style.display = searchInput.value ? "block" : "none";
    applyFilters();
  });

  clearBtn.addEventListener("click", function () {
    searchInput.value = "";
    clearBtn.style.display = "none";
    applyFilters();
    searchInput.focus();
  });

  document.getElementById("sortAZ").addEventListener("click", function () {
    currentSort = "az";
    document.getElementById("sortAZ").classList.add("active");
    document.getElementById("sortZA").classList.remove("active");
    applyFilters();
  });

  document.getElementById("sortZA").addEventListener("click", function () {
    currentSort = "za";
    document.getElementById("sortZA").classList.add("active");
    document.getElementById("sortAZ").classList.remove("active");
    applyFilters();
  });

  document.getElementById("usersTableBody").addEventListener("click", function (event) {
    const editBtn = event.target.closest(".edit-user");
    const deleteBtn = event.target.closest(".delete-user");

    if (editBtn) {
      editUser(editBtn.getAttribute("data-user-id"));
      return;
    }

    if (deleteBtn) {
      deleteUser(deleteBtn.getAttribute("data-user-id"));
    }
  });
});
