const API_BASE = window.API_URL || "https://kgl-project-3g6j.onrender.com";

function getToken() {
  return localStorage.getItem('token');
}

function buildBarChart(canvasId, labels, data) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Sales (UGX)',
        data,
        backgroundColor: '#1B5E20'
      }]
    },
    options: { responsive: true }
  });
}

function buildPieChart(canvasId, labels, data) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  return new Chart(ctx, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: ['#43a047', '#1B5E20', '#aa6900']
      }]
    },
    options: { responsive: true }
  });
}

function buildLineChart(canvasId, labels, data) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  return new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Total Revenue (UGX)',
        data,
        borderColor: '#1B5E20',
        backgroundColor: 'rgba(27,94,32,0.08)',
        fill: true,
        tension: 0.3,
        pointBackgroundColor: '#1B5E20'
      }]
    },
    options: { responsive: true }
  });
}

async function loadStatistics() {
  const token = getToken();
  if (!token) {
    window.location.href = '/loginform/html/login.html';
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/manager/statistics`, {
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

    if (!res.ok) throw new Error('Failed to load statistics');

    const stats = await res.json();

    buildBarChart(
      'monthlySalesChart',
      stats.monthlySales.labels,
      stats.monthlySales.data
    );

    buildPieChart(
      'customerActivityChart',
      stats.customerActivity.labels,
      stats.customerActivity.data
    );

    buildLineChart(
      'yearlyOverviewChart',
      stats.yearlyOverview.labels,
      stats.yearlyOverview.data
    );

  } catch (err) {
    console.error('Statistics load error:', err);
  }
}

document.addEventListener('DOMContentLoaded', loadStatistics);

