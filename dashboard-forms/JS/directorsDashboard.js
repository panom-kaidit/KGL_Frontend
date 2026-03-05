const API_BASE = window.API_URL || "https://kgl-project-3g6j.onrender.com";

let performanceChart = null;

function getToken() {
  return localStorage.getItem("token");
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatUGX(amount) {
  return "UGX " + toNumber(amount).toLocaleString("en-US");
}

function formatCount(value) {
  return toNumber(value).toLocaleString("en-US");
}

function formatKg(value) {
  return toNumber(value).toLocaleString("en-US") + " KG";
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function fetchJson(path) {
  const token = getToken();
  if (!token) {
    window.location.href = "../../loginform/html/login.html";
    return null;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    }
  });

  if (res.status === 401 || res.status === 403) {
    window.location.href = "../../loginform/html/login.html";
    return null;
  }

  if (!res.ok) {
    let message = "Request failed";
    try {
      const body = await res.json();
      message = body.message || message;
    } catch (_) {
      // Keep default message if response is not JSON.
    }
    throw new Error(`${path} -> ${res.status} ${message}`);
  }

  return res.json();
}

// Sum payment history for credit sales.
function getCreditPaymentsTotal(sale) {
  if (!Array.isArray(sale.paymentHistory)) return 0;
  return sale.paymentHistory.reduce((sum, p) => sum + toNumber(p.amount), 0);
}

// Calculate a stable sale value.
function getSaleValue(sale) {
  const tonnage = toNumber(sale.tonnage);
  const price = toNumber(sale.pricePerKg);
  const fallback = tonnage * price;

  if (sale.saleType === "cash") {
    return toNumber(sale.amountPaid) || fallback;
  }

  const paid = getCreditPaymentsTotal(sale);
  const due = toNumber(sale.amountDue);
  const creditValue = paid + due;
  return creditValue || fallback;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function getLastSixMonthKeys() {
  const keys = [];
  const date = new Date();
  date.setDate(1);

  for (let i = 5; i >= 0; i--) {
    const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    keys.push(key);
  }
  return keys;
}

function getMonthLabel(yyyyMm) {
  const [year, month] = yyyyMm.split("-");
  const dt = new Date(Number(year), Number(month) - 1, 1);
  return dt.toLocaleString("en-US", { month: "short" });
}

function buildMonthlyRevenueSeries(sales) {
  const monthKeys = getLastSixMonthKeys();
  const revenueMap = {};

  monthKeys.forEach((k) => {
    revenueMap[k] = 0;
  });

  sales.forEach((sale) => {
    if (!sale || typeof sale.date !== "string") return;
    if (sale.date.length < 7) return;
    const key = sale.date.slice(0, 7);
    if (!(key in revenueMap)) return;
    revenueMap[key] += getSaleValue(sale);
  });

  return {
    labels: monthKeys.map(getMonthLabel),
    data: monthKeys.map((k) => Math.round(revenueMap[k] * 100) / 100)
  };
}

function renderChart(sales) {
  const canvas = document.getElementById("performanceChart");
  if (!canvas || typeof Chart === "undefined") return;

  const ctx = canvas.getContext("2d");
  const series = buildMonthlyRevenueSeries(sales);

  if (performanceChart) {
    performanceChart.destroy();
  }

  performanceChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: series.labels,
      datasets: [
        {
          label: "Revenue (UGX)",
          data: series.data,
          borderColor: "#1B5E20",
          tension: 0.2,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

function mergeSales(salesData, creditsData) {
  const map = new Map();
  [...salesData, ...creditsData].forEach((sale) => {
    if (sale && sale._id) {
      map.set(String(sale._id), sale);
    }
  });
  return Array.from(map.values());
}

function updateTopCards(allSales, creditSales) {
  const totalRevenue = allSales.reduce((sum, sale) => sum + getSaleValue(sale), 0);
  const totalSales = allSales.length;
  const totalUnitsSold = allSales.reduce((sum, sale) => sum + toNumber(sale.tonnage), 0);
  const activeBranches = new Set(
    allSales.map((sale) => String(sale.branch || "").trim()).filter(Boolean)
  ).size;

  setText("totalRevenue", formatUGX(Math.round(totalRevenue)));
  setText("totalSales", formatCount(totalSales));
  setText("totalUnitsSold", `${formatCount(Math.round(totalUnitsSold))} KG`);
  setText("activeBranches", formatCount(activeBranches));
  setText("totalCreditSales", formatCount(creditSales.length));
}

function showDashboardLoadError(message) {
  setText("totalRevenue", "--");
  setText("totalSales", "--");
  setText("totalUnitsSold", "--");
  setText("activeBranches", "--");
  setText("totalCreditSales", "--");

  const tableContainerTitle = document.querySelector(".table-container h3");
  if (tableContainerTitle) {
    tableContainerTitle.textContent = `Company Performance Overview (${message})`;
  }
}

// Build branch cards data from available endpoints.
function buildBranchRows(procurements, credits, sales) {
  const branchMap = {};

  function ensureBranch(branchName) {
    const name = String(branchName || "").trim();
    if (!name) return null;

    if (!branchMap[name]) {
      branchMap[name] = {
        branchName: name,
        totalSales: 0,
        totalCreditSales: 0,
        availableStocks: 0,
        remainingStock: 0
      };
    }

    return branchMap[name];
  }

  // Add procured stock as available stocks per branch.
  procurements.forEach((p) => {
    const row = ensureBranch(p.branch);
    if (!row) return;
    row.availableStocks += toNumber(p.tonnage);
    row.remainingStock += toNumber(p.tonnage);
  });

  // Merge sales arrays and de-duplicate by _id.
  const merged = new Map();
  [...sales, ...credits].forEach((s) => {
    if (s && s._id) merged.set(String(s._id), s);
  });

  merged.forEach((sale) => {
    const row = ensureBranch(sale.branch);
    if (!row) return;

    const value = getSaleValue(sale);
    const kg = toNumber(sale.tonnage);

    row.totalSales += value;
    row.remainingStock -= kg;

    if (sale.saleType === "credit") {
      row.totalCreditSales += value;
    }
  });

  return Object.values(branchMap)
    .map((row) => ({
      branchName: row.branchName,
      totalSales: Math.round(row.totalSales),
      totalCreditSales: Math.round(row.totalCreditSales),
      availableStocks: Math.max(0, Math.round(row.availableStocks * 100) / 100),
      remainingStock: Math.max(0, Math.round(row.remainingStock * 100) / 100)
    }))
    .sort((a, b) => a.branchName.localeCompare(b.branchName));
}

function renderBranchCardsMessage(message, toneClass) {
  const container = document.getElementById("branchPerformanceCards");
  if (!container) return;

  container.innerHTML = `
    <div class="card ${toneClass}">
      <h3>Branch Name</h3>
      <h1>${escapeHtml(message)}</h1>
      <p>Total Sales: --</p>
      <p>Credit Sales: --</p>
      <p>Available Stocks: -- KG</p>
      <p>Remaining Stock: -- KG</p>
    </div>
  `;
}

function renderBranchCards(rows) {
  const container = document.getElementById("branchPerformanceCards");
  if (!container) return;

  if (!rows.length) {
    renderBranchCardsMessage("No branch data available", "yellow");
    return;
  }

  const colors = ["green", "yellow", "darkgreen"];

  container.innerHTML = rows
    .map((row, idx) => `
      <div class="card ${colors[idx % colors.length]}">
        <h3>Branch Name</h3>
        <h1>${escapeHtml(row.branchName)}</h1>
        <p>Total Sales: ${formatUGX(row.totalSales)}</p>
        <p>Credit Sales: ${formatUGX(row.totalCreditSales)}</p>
        <p>Available Stocks: ${formatKg(row.availableStocks)}</p>
        <p>Remaining Stock: ${formatKg(row.remainingStock)}</p>
      </div>
    `)
    .join("");
}

async function loadBranchPerformanceOverview() {
  try {
    renderBranchCardsMessage("Loading...", "darkgreen");

    // Existing endpoints only.
    const [procurementRes, creditsRes, salesRes] = await Promise.allSettled([
      fetchJson("/procurement"),
      fetchJson("/credits/all"),
      fetchJson("/sales/branch")
    ]);

    const procurements =
      procurementRes.status === "fulfilled" && Array.isArray(procurementRes.value?.data)
        ? procurementRes.value.data
        : [];

    const credits =
      creditsRes.status === "fulfilled" && Array.isArray(creditsRes.value?.data)
        ? creditsRes.value.data
        : [];

    const sales =
      salesRes.status === "fulfilled" && Array.isArray(salesRes.value?.data)
        ? salesRes.value.data
        : [];

    const rows = buildBranchRows(procurements, credits, sales);

    if (!rows.length) {
      renderBranchCardsMessage("No branch data available", "yellow");
      return;
    }

    renderBranchCards(rows);
  } catch (error) {
    console.error("Failed to load branch performance:", error);
    renderBranchCardsMessage("Failed to load branch performance", "darkgreen");
  }
}

async function loadDirectorDashboard() {
  try {
    // Try both existing endpoints. Each may return data depending on role/branch setup.
    let salesData = [];
    let creditsData = [];

    try {
      const salesRes = await fetchJson("/sales/branch");
      salesData = Array.isArray(salesRes?.data) ? salesRes.data : [];
    } catch (error) {
      console.warn("Sales branch endpoint failed:", error.message);
    }

    try {
      const creditsRes = await fetchJson("/credits/all");
      creditsData = Array.isArray(creditsRes?.data) ? creditsRes.data : [];
    } catch (error) {
      console.warn("Credits endpoint failed:", error.message);
    }

    const allSales = mergeSales(salesData, creditsData);
    updateTopCards(allSales, creditsData);
    renderChart(allSales);

    // Load branch cards below the chart.
    await loadBranchPerformanceOverview();
  } catch (error) {
    console.error("Failed to load Director dashboard:", error);
    showDashboardLoadError("failed to load live data");
    renderBranchCardsMessage("Failed to load branch performance", "darkgreen");
  }
}

document.addEventListener("DOMContentLoaded", loadDirectorDashboard);

