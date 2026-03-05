/**
 * directorUserManagement.js
 *
 * Same UI logic pattern as manager usermanagement.js,
 * but for Director view.
 */

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
    .replace(/\"/g, "&quot;");
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
        '<td class="row-num">' +
        (i + 1) +
        "</td>" +
        "<td>" +
        '<div class="user-name-cell">' +
        '<div class="avatar">' +
        avatarLetter(u.name) +
        "</div>" +
        "<span>" +
        escHtml(u.name || "-") +
        "</span>" +
        "</div>" +
        "</td>" +
        "<td>" +
        escHtml(u.email || "-") +
        "</td>" +
        "<td>" +
        '<span class="role-badge ' +
        roleBadgeClass(u.role) +
        '">' +
        escHtml(u.role || "-") +
        "</span>" +
        "</td>" +
        '<td><span class="branch-badge">' +
        escHtml(u.branch || "-") +
        "</span></td>" +
        "<td>" +
        escHtml(u.phone || "-") +
        "</td>" +
        "</tr>"
      );
    })
    .join("");
}

function applyFilters() {
  const query = document
    .getElementById("searchInput")
    .value.trim()
    .toLowerCase();

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

async function loadDirectorUsers() {
  const token = getToken();
  if (!token) {
    window.location.href = "../../loginform/html/login.html";
    return;
  }

  const decoded = decodeToken(token);
  if (!decoded || decoded.role !== "Director") {
    showAlert("Access denied. This page is for Directors only.", "error");
    return;
  }

  // Try common list endpoints in order, so frontend works with existing backend shape.
  const endpoints = ["/users/all", "/users", "/users/branch"];
  let loaded = false;

  for (let i = 0; i < endpoints.length; i++) {
    try {
      const res = await fetch(API_BASE + endpoints[i], {
        headers: { Authorization: "Bearer " + token }
      });

      const body = await res.json();
      // Temporary debug logs for response troubleshooting.
      console.log("Director user fetch:", endpoints[i], res.status, body);

      if (!res.ok) {
        continue;
      }

      allUsers = body.data || [];

      // Keep header text simple and helpful.
      if (body.branch) {
        document.getElementById("branch-label").textContent =
          "Branch: " + body.branch + " - " + allUsers.length + " users";
      } else {
        document.getElementById("branch-label").textContent =
          "All Branches - " + allUsers.length + " users";
      }

      applyFilters();
      loaded = true;
      break;
    } catch {
      // Try next endpoint.
    }
  }

  if (!loaded) {
    showAlert("Failed to load users for Director view.", "error");
    document.getElementById("usersTableBody").innerHTML =
      '<tr><td colspan="6" class="text-center">Could not load users.</td></tr>';
    document.getElementById("branch-label").textContent = "Could not load users.";
  }
}

// Same interaction pattern as manager page.
document.addEventListener("DOMContentLoaded", function () {
  loadDirectorUsers();

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
});

