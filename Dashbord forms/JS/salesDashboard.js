const API_BASE = window.API_URL || "https://kgl-project-3g6j.onrender.com";

const menuToggle = document.querySelector('.menu-toggle');
const sidebar = document.querySelector('.sidebar');

if (menuToggle) {
  menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('active');
  });
}

function getToken() {
  return localStorage.getItem('token');
}

function formatUGX(amount) {
  return 'UGX ' + Number(amount).toLocaleString();
}

async function loadDashboardSummary() {
  const token = getToken();
  if (!token) {
    window.location.href = '/loginform/html/login.html';
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/sales/dashboard`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      }
    });

    if (res.status === 401 || res.status === 403) {
      window.location.href = '/loginform/html/login.html';
      return;
    }

    if (!res.ok) throw new Error('Failed to load dashboard data');

    const data = await res.json();

    const cards = document.querySelectorAll('.card--wrapper .payment--card');

    // Today's Sales
    cards[0].querySelector('.amount--value').textContent = formatUGX(data.todaySales);

    // Customers Served Today
    cards[1].querySelector('.amount--value').textContent = data.customersToday;

    // Weekly Customers
    cards[2].querySelector('.amount--value').textContent = data.weeklyCustomers;

    // Weekly Sales
    cards[3].querySelector('.amount--value').textContent = formatUGX(data.weeklySales);

    // Best Day
    cards[4].querySelector('.amount--value').textContent = data.bestDay.day;
    cards[4].querySelector('.card-detail').textContent =
      data.bestDay.amount > 0
        ? formatUGX(data.bestDay.amount) + ' sales'
        : 'No sales recorded yet';

  } catch (err) {
    console.error('Dashboard load error:', err);
  }
}

document.addEventListener('DOMContentLoaded', loadDashboardSummary);

