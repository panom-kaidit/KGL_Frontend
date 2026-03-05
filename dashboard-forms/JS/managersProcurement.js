const API_BASE_URL = window.API_URL || "https://kgl-project-3g6j.onrender.com";

let allProcurements = [];
let sortDirection   = 'desc';

// ADDED: XSS guard for all server-sourced data injected into innerHTML
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function decodeToken(token) {
  try   { return JSON.parse(atob(token.split('.')[1])); }
  catch { return null; }
}

document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '../../loginform/html/login.html';
    return;
  }
  setupControls();
  loadProcurements();
});

function setupControls() {
  const searchInput = document.getElementById('searchInput');
  const clearBtn    = document.getElementById('clearSearch');
  const sortDescBtn = document.getElementById('sortDesc');
  const sortAscBtn  = document.getElementById('sortAsc');

  searchInput.addEventListener('input', () => {
    clearBtn.style.display = searchInput.value ? 'block' : 'none';
    applyFilters();
  });

  clearBtn.addEventListener('click', () => {
    searchInput.value      = '';
    clearBtn.style.display = 'none';
    applyFilters();
  });

  sortDescBtn.addEventListener('click', () => {
    sortDirection = 'desc';
    sortDescBtn.classList.add('active');
    sortAscBtn.classList.remove('active');
    applyFilters();
  });

  sortAscBtn.addEventListener('click', () => {
    sortDirection = 'asc';
    sortAscBtn.classList.add('active');
    sortDescBtn.classList.remove('active');
    applyFilters();
  });
}

function applyFilters() {
  const rawQuery = document.getElementById('searchInput').value.trim();

  // FIXED: The regex was missing a properly escaped backslash in the character class.
  // This safely escapes regex special characters before building new RegExp().
  const safeQuery = rawQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern   = safeQuery ? new RegExp(safeQuery, 'i') : null;

  const filtered = pattern
    ? allProcurements.filter((proc) => {
        const haystack = [
          proc.produceName, proc.produceType, proc.dealerName,
          proc.contact, proc.branch, proc.recordedByName, proc.date, proc.time
        ].join(' ');
        return pattern.test(haystack);
      })
    : [...allProcurements];

  filtered.sort((a, b) => {
    const diff = new Date(a.date) - new Date(b.date);
    return sortDirection === 'desc' ? -diff : diff;
  });

  updateResultCount(filtered.length, allProcurements.length);
  displayProcurements(filtered);
}

function updateResultCount(shown, total) {
  const el = document.getElementById('resultCount');
  if (!el) return;
  el.textContent = shown === total
    ? `${total} record${total !== 1 ? 's' : ''}`
    : `Showing ${shown} of ${total} records`;
}

async function loadProcurements() {
  try {
    const token = localStorage.getItem('token');

    const response = await fetch(`${API_BASE_URL}/procurement`, {
      method:  'GET',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });

    if (response.status === 401 || response.status === 403) {
      window.location.href = '../../loginform/html/login.html';
      return;
    }

    if (!response.ok) throw new Error(`Failed to fetch procurements: ${response.status}`);

    const result = await response.json();

    // FIXED (BACK-01): Previously the API returned ALL branches and the frontend
    // filtered client-side. Now the backend filters by branch (from JWT), so we
    // just use the data as returned — no client-side branch filter needed.
    allProcurements = result.data || [];

    applyFilters();

  } catch (error) {
    console.error('Error loading procurements:', error);
    document.getElementById('procurementTableBody').innerHTML =
      '<tr class="error-row"><td colspan="12" class="text-center">Error loading procurements. Please try again.</td></tr>';
  }
}

function displayProcurements(procurements) {
  const tableBody        = document.getElementById('procurementTableBody');
  const noResultsMessage = document.getElementById('noResultsMessage');

  if (!procurements || procurements.length === 0) {
    tableBody.innerHTML        = '';
    noResultsMessage.style.display = 'flex';
    return;
  }

  noResultsMessage.style.display = 'none';

  // FIXED (SECURITY-08 / XSS): All fields were injected raw into innerHTML.
  // e.g. proc.produceName could contain <script>alert(1)</script>.
  // Now all server-sourced values are escaped with escHtml().
  tableBody.innerHTML = procurements.map((proc) => {
    const statusBadge = getStatusBadge(proc.date);
    return `
      <tr class="procurement-row" data-id="${escHtml(proc._id)}">
        <td>${escHtml(formatDate(proc.date))}</td>
        <td>${escHtml(proc.time  || '-')}</td>
        <td>${escHtml(proc.produceName || '-')}</td>
        <td>${escHtml(proc.produceType || '-')}</td>
        <td>${formatNumber(proc.tonnage || 0)} kg</td>
        <td>${formatCurrency(proc.cost  || 0)}</td>
        <td>${formatCurrency(proc.sellingPrice || 0)}</td>
        <td>${escHtml(proc.dealerName || '-')}</td>
        <td>${escHtml(proc.contact || '-')}</td>
        <td><span class="badge branch">${escHtml(proc.branch || '-')}</span></td>
        <td>${escHtml(proc.recordedByName || '-')}</td>
        <td>${statusBadge}</td>
      </tr>
    `;
  }).join('');
}

function getStatusBadge(dateString) {
  const procDate = new Date(dateString);
  const today    = new Date();
  today.setHours(0, 0, 0, 0);
  procDate.setHours(0, 0, 0, 0);

  if (procDate.getTime() === today.getTime()) return '<span class="badge status-today">Today</span>';
  if (procDate > today)                        return '<span class="badge status-upcoming">Upcoming</span>';
  return                                               '<span class="badge status-past">Past</span>';
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatNumber(num) {
  return Math.round(num).toLocaleString('en-US');
}

function formatCurrency(num) {
  return num.toLocaleString('en-US', {
    style: 'currency', currency: 'UGX', minimumFractionDigits: 0, maximumFractionDigits: 0
  }).replace('UGX', '').trim();
}

function showAlert(message, type = 'info') {
  const alertContainer = document.createElement('div');
  alertContainer.style.cssText = `position:fixed;top:20px;right:20px;padding:15px 20px;border-radius:4px;font-weight:500;z-index:9999;max-width:400px;`;
  const colors = { success: '#4CAF50', error: '#f44336', info: '#2196F3', warning: '#ff9800' };
  alertContainer.style.backgroundColor = colors[type] || colors.info;
  alertContainer.style.color           = '#fff';
  // Safe: textContent not innerHTML
  alertContainer.textContent = message;
  document.body.appendChild(alertContainer);
  setTimeout(() => alertContainer.remove(), 3000);
}

