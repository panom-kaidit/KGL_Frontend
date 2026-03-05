/**
 * usermanagement.js — Branch User List
 *
 * Fetches all users belonging to the logged-in manager's branch
 * via GET /users/branch, renders them into a searchable, sortable table.
 *
 * Branch filtering is enforced server-side from the JWT token;
 * the frontend never sends a branch value in the request.
 */

'use strict';

const API_BASE = window.API_URL || "https://kgl-project-3g6j.onrender.com";

// ── State ─────────────────────────────────────────────────────────────────────

let allUsers    = [];   // full list from API
let currentSort = 'az'; // 'az' | 'za'

// ── Auth helpers ──────────────────────────────────────────────────────────────

function getToken() {
  return localStorage.getItem('token');
}

function decodeToken(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

// ── Alert ─────────────────────────────────────────────────────────────────────

function showAlert(message, type) {
  const box = document.getElementById('alert-box');
  box.className = 'um-alert ' + (type || 'error');
  box.textContent = message;
}

// ── Avatar helper — first letter of name ─────────────────────────────────────

function avatarLetter(name) {
  return (name || '?').charAt(0).toUpperCase();
}

// ── Role badge CSS class ──────────────────────────────────────────────────────

function roleBadgeClass(role) {
  var map = {
    'Manager':     'role-manager',
    'Sales-agent': 'role-sales-agent',
    'Director':    'role-director'
  };
  return map[role] || 'role-default';
}

// ── Basic XSS guard ───────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Render table rows ─────────────────────────────────────────────────────────

function renderTable(users) {
  var tbody     = document.getElementById('usersTableBody');
  var noResults = document.getElementById('noResultsMessage');
  var countEl   = document.getElementById('resultCount');

  if (users.length === 0) {
    tbody.innerHTML         = '';
    noResults.style.display = 'flex';
    countEl.textContent     = '';
    return;
  }

  noResults.style.display = 'none';
  countEl.textContent     = 'Showing ' + users.length + ' user' + (users.length !== 1 ? 's' : '');

  tbody.innerHTML = users.map(function(u, i) {
    return '<tr>' +
      '<td class="row-num">' + (i + 1) + '</td>' +
      '<td>' +
        '<div class="user-name-cell">' +
          '<div class="avatar">' + avatarLetter(u.name) + '</div>' +
          '<span>' + escHtml(u.name || '—') + '</span>' +
        '</div>' +
      '</td>' +
      '<td>' + escHtml(u.email || '—') + '</td>' +
      '<td>' +
        '<span class="role-badge ' + roleBadgeClass(u.role) + '">' +
          escHtml(u.role || '—') +
        '</span>' +
      '</td>' +
      '<td><span class="branch-badge">' + escHtml(u.branch || '—') + '</span></td>' +
      '<td>' + escHtml(u.phone || '—') + '</td>' +
    '</tr>';
  }).join('');
}

// ── Apply current search + sort and re-render ─────────────────────────────────

function applyFilters() {
  var query = document.getElementById('searchInput').value.trim().toLowerCase();

  var filtered = allUsers.filter(function(u) {
    var haystack = ((u.name || '') + ' ' + (u.email || '') + ' ' +
                    (u.role || '') + ' ' + (u.branch || '') + ' ' +
                    (u.phone || '')).toLowerCase();
    return haystack.indexOf(query) !== -1;
  });

  filtered.sort(function(a, b) {
    var nameA = (a.name || '').toLowerCase();
    var nameB = (b.name || '').toLowerCase();
    return currentSort === 'az'
      ? nameA.localeCompare(nameB)
      : nameB.localeCompare(nameA);
  });

  renderTable(filtered);
}

// ── Fetch branch users from the API ──────────────────────────────────────────

async function loadBranchUsers() {
  var token = getToken();
  if (!token) {
    window.location.href = '../../loginform/html/login.html';
    return;
  }

  var decoded = decodeToken(token);
  if (!decoded || decoded.role !== 'Manager') {
    showAlert('Access denied. This page is for Managers only.', 'error');
    return;
  }

  try {
    var res  = await fetch(API_BASE + '/users/branch', {
      headers: { Authorization: 'Bearer ' + token }
    });
    var body = await res.json();

    if (!res.ok) {
      showAlert(body.message || 'Failed to load users.', 'error');
      document.getElementById('usersTableBody').innerHTML =
        '<tr><td colspan="6" class="text-center">Could not load users.</td></tr>';
      return;
    }

    allUsers = body.data || [];

    document.getElementById('branch-label').textContent =
      'Branch: ' + body.branch + ' — ' + body.count +
      ' user' + (body.count !== 1 ? 's' : '');

    applyFilters();

  } catch {
    showAlert('Network error. Please check your connection.', 'error');
    document.getElementById('usersTableBody').innerHTML =
      '<tr><td colspan="6" class="text-center">Network error.</td></tr>';
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function() {
  loadBranchUsers();

  var searchInput = document.getElementById('searchInput');
  var clearBtn    = document.getElementById('clearSearch');

  searchInput.addEventListener('input', function() {
    clearBtn.style.display = searchInput.value ? 'block' : 'none';
    applyFilters();
  });

  clearBtn.addEventListener('click', function() {
    searchInput.value      = '';
    clearBtn.style.display = 'none';
    applyFilters();
    searchInput.focus();
  });

  document.getElementById('sortAZ').addEventListener('click', function() {
    currentSort = 'az';
    document.getElementById('sortAZ').classList.add('active');
    document.getElementById('sortZA').classList.remove('active');
    applyFilters();
  });

  document.getElementById('sortZA').addEventListener('click', function() {
    currentSort = 'za';
    document.getElementById('sortZA').classList.add('active');
    document.getElementById('sortAZ').classList.remove('active');
    applyFilters();
  });
});
