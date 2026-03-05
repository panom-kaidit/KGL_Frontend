const API_BASE = window.API_URL || "https://kgl-project-3g6j.onrender.com";

function getToken() {
  return localStorage.getItem("token");
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatUGX(value) {
  return "UGX " + toNumber(value).toLocaleString("en-US");
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

  const response = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    }
  });

  if (response.status === 401 || response.status === 403) {
    window.location.href = "../../loginform/html/login.html";
    return null;
  }

  if (!response.ok) {
    let message = "Request failed";
    try {
      const errorBody = await response.json();
      message = errorBody.message || message;
    } catch (_) {
      // Keep fallback message
    }
    throw new Error(`${path} -> ${response.status} ${message}`);
  }

  return response.json();
}

function getCreditSaleValue(sale) {
  const paid = Array.isArray(sale.paymentHistory)
    ? sale.paymentHistory.reduce((sum, p) => sum + toNumber(p.amount), 0)
    : 0;
  const due = toNumber(sale.amountDue);
  const fallback = toNumber(sale.tonnage) * toNumber(sale.pricePerKg);
  return paid + due || fallback;
}

function getAnySaleValue(sale) {
  if (sale.saleType === "credit") return getCreditSaleValue(sale);
  const paid = toNumber(sale.amountPaid);
  const fallback = toNumber(sale.tonnage) * toNumber(sale.pricePerKg);
  return paid || fallback;
}

function normalizeBranchName(name) {
  return String(name || "").trim();
}

function buildBranchMap(procurements, credits, sales) {
  const branchStats = {};

  function ensureBranch(branch) {
    const key = normalizeBranchName(branch);
    if (!key) return null;
    if (!branchStats[key]) {
      branchStats[key] = {
        branch: key,
        procuredKg: 0,
        soldKg: 0,
        totalSales: 0,
        totalCreditSales: 0
      };
    }
    return branchStats[key];
  }

  procurements.forEach((row) => {
    const branchRow = ensureBranch(row.branch);
    if (!branchRow) return;
    branchRow.procuredKg += toNumber(row.tonnage);
  });

  // Combine sales + credits with de-duplication by _id.
  const uniqueSalesMap = new Map();
  [...sales, ...credits].forEach((row) => {
    if (row && row._id) uniqueSalesMap.set(String(row._id), row);
  });

  uniqueSalesMap.forEach((row) => {
    const branchRow = ensureBranch(row.branch);
    if (!branchRow) return;

    const saleValue = getAnySaleValue(row);
    const saleKg = toNumber(row.tonnage);

    branchRow.totalSales += saleValue;
    branchRow.soldKg += saleKg;

    if (row.saleType === "credit") {
      branchRow.totalCreditSales += getCreditSaleValue(row);
    }
  });

  return Object.values(branchStats).map((b) => ({
    branch: b.branch,
    totalSales: Math.round(b.totalSales),
    totalCreditSales: Math.round(b.totalCreditSales),
    remainingStockKg: Math.max(0, Math.round((b.procuredKg - b.soldKg) * 100) / 100)
  }));
}

function renderMessage(message, toneClass) {
  const cardsContainer = document.getElementById("branchCards");
  cardsContainer.innerHTML = `
    <div class="card ${toneClass}">
      <h3>Branch Performance</h3>
      <h1>${escapeHtml(message)}</h1>
      <p>Total Sales: --</p>
      <p>Total Credit Sales: --</p>
      <p>Remaining Stock: -- KG</p>
    </div>
  `;
}

function renderBranchCards(rows) {
  const cardsContainer = document.getElementById("branchCards");

  if (!rows.length) {
    renderMessage("No branch data available", "yellow");
    return;
  }

  const colorClasses = ["green", "yellow", "darkgreen"];

  cardsContainer.innerHTML = rows
    .sort((a, b) => a.branch.localeCompare(b.branch))
    .map((row, index) => {
      const colorClass = colorClasses[index % colorClasses.length];
      return `
        <div class="card ${colorClass}">
          <h3>Branch Name</h3>
          <h1>${escapeHtml(row.branch)}</h1>
          <p>Total Sales: ${formatUGX(row.totalSales)}</p>
          <p>Total Credit Sales: ${formatUGX(row.totalCreditSales)}</p>
          <p>Remaining Stock: ${formatKg(row.remainingStockKg)}</p>
        </div>
      `;
    })
    .join("");
}

async function loadBranchPerformance() {
  try {
    renderMessage("Loading branch data...", "darkgreen");

    // Use existing backend endpoints only.
    const [procurementRes, creditRes, salesRes] = await Promise.allSettled([
      fetchJson("/procurement"),
      fetchJson("/credits/all"),
      fetchJson("/sales/branch")
    ]);

    const procurements =
      procurementRes.status === "fulfilled" && Array.isArray(procurementRes.value?.data)
        ? procurementRes.value.data
        : [];

    const credits =
      creditRes.status === "fulfilled" && Array.isArray(creditRes.value?.data)
        ? creditRes.value.data
        : [];

    const sales =
      salesRes.status === "fulfilled" && Array.isArray(salesRes.value?.data)
        ? salesRes.value.data
        : [];

    const hasAnyData = procurements.length || credits.length || sales.length;
    if (!hasAnyData) {
      renderMessage("No branch data available", "yellow");
      return;
    }

    const branchRows = buildBranchMap(procurements, credits, sales);
    renderBranchCards(branchRows);
  } catch (error) {
    console.error("Branch performance load error:", error);
    renderMessage("Failed to load branch performance", "darkgreen");
  }
}

document.addEventListener("DOMContentLoaded", loadBranchPerformance);

