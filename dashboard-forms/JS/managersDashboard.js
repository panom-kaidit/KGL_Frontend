const API_BASE_URL = window.API_URL || "https://kgl-project-3g6j.onrender.com";

// ADDED: XSS guard - server-sourced strings escaped before innerHTML injection
function escHtml(str) {
  return String(str === null || str === undefined ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatUGX(value) {
  return 'UGX ' + toNumber(value).toLocaleString('en-US');
}

document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '../../loginform/html/login.html';
    return;
  }

  // Keep existing inventory flow.
  loadInventory();

  // Load manager branch performance cards.
  loadBranchSummary();
});

async function loadInventory() {
  try {
    const token = localStorage.getItem('token');

    const res = await fetch(`${API_BASE_URL}/api/inventory`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (res.status === 401 || res.status === 403) {
      window.location.href = '../../loginform/html/login.html';
      return;
    }

    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    const { summary, items } = await res.json();

    updateCards(summary);
    renderTable(items);

  } catch (err) {
    console.error('Failed to load inventory:', err);
    document.getElementById('inventoryTableBody').innerHTML =
      `<tr><td colspan="6" style="text-align:center;color:#c62828;padding:24px;">
        Failed to load inventory. Please try again.
      </td></tr>`;
  }
}

function updateCards(summary) {
  document.getElementById('totalStockPct').textContent = `${summary.totalStockPercentage}%`;
  document.getElementById('inStockLabel').textContent = `${summary.inStockCount} item${summary.inStockCount !== 1 ? 's' : ''} well stocked`;
  document.getElementById('lowStockCount').textContent = `${summary.lowStockCount} Item${summary.lowStockCount !== 1 ? 's' : ''}`;
  document.getElementById('outOfStockCount').textContent = `${summary.outOfStockCount} Item${summary.outOfStockCount !== 1 ? 's' : ''}`;
}

function renderTable(items) {
  const tbody = document.getElementById('inventoryTableBody');

  if (!items || items.length === 0) {
    tbody.innerHTML =
      `<tr><td colspan="6" style="text-align:center;color:#999;padding:24px;">
        No inventory items found.
      </td></tr>`;
    return;
  }

  // FIXED (SECURITY-08 / XSS): item.itemName and item.category were injected raw.
  // A stored payload in either field would execute. Now escaped with escHtml().
  tbody.innerHTML = items.map(item => {
    const { label, cls } = getStatus(item.stockKg);
    return `
      <tr>
        <td>${escHtml(item.itemName)}</td>
        <td>${escHtml(item.category || '-')}</td>
        <td>${formatNumber(item.stockKg)}</td>
        <td>${formatCurrency(item.costPerKg)}</td>
        <td>${formatCurrency(item.salePricePerKg)}</td>
        <td><span class="status ${cls}">${label}</span></td>
      </tr>
    `;
  }).join('');
}

// Fetch manager branch sales summary from existing branch endpoint.
async function loadBranchSummary() {
  // Loading state for new cards.
  document.getElementById('branchTotalSales').textContent = 'Loading...';
  document.getElementById('branchTransactions').textContent = 'Loading...';
  document.getElementById('branchCreditSales').textContent = 'Loading...';

  try {
    const token = localStorage.getItem('token');

    const res = await fetch(`${API_BASE_URL}/sales/branch`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (res.status === 401 || res.status === 403) {
      window.location.href = '../../loginform/html/login.html';
      return;
    }

    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    const body = await res.json();
    const sales = Array.isArray(body.data) ? body.data : [];

    if (!sales.length) {
      document.getElementById('branchTotalSales').textContent = 'No branch data available';
      document.getElementById('branchTransactions').textContent = 'No branch data available';
      document.getElementById('branchCreditSales').textContent = 'No branch data available';
      return;
    }

    let totalSales = 0;
    let totalTransactions = sales.length;
    let totalCreditSales = 0;

    sales.forEach((sale) => {
      const tonnage = toNumber(sale.tonnage);
      const pricePerKg = toNumber(sale.pricePerKg);
      const fallbackValue = tonnage * pricePerKg;

      let saleValue = 0;
      if (sale.saleType === 'credit') {
        const paid = Array.isArray(sale.paymentHistory)
          ? sale.paymentHistory.reduce((sum, p) => sum + toNumber(p.amount), 0)
          : 0;
        const due = toNumber(sale.amountDue);
        saleValue = paid + due || fallbackValue;
        totalCreditSales += saleValue;
      } else {
        saleValue = toNumber(sale.amountPaid) || fallbackValue;
      }

      totalSales += saleValue;
    });

    document.getElementById('branchTotalSales').textContent = formatUGX(Math.round(totalSales));
    document.getElementById('branchTransactions').textContent = totalTransactions.toLocaleString('en-US');
    document.getElementById('branchCreditSales').textContent = formatUGX(Math.round(totalCreditSales));

  } catch (error) {
    console.error('Failed to load branch summary:', error);
    document.getElementById('branchTotalSales').textContent = 'No branch data available';
    document.getElementById('branchTransactions').textContent = 'No branch data available';
    document.getElementById('branchCreditSales').textContent = 'No branch data available';
  }
}

function getStatus(stockKg) {
  if (stockKg === 0) return { label: 'Out of Stock', cls: 'red' };
  if (stockKg <= 200) return { label: 'Low Stock', cls: 'yellow' };
  return { label: 'In Stock', cls: 'green' };
}

function formatNumber(num) {
  return Number(num).toLocaleString('en-US');
}

function formatCurrency(num) {
  return Number(num).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

