const API_BASE = window.API_URL || "https://kgl-project-3g6j.onrender.com";

/**
 * Read JWT token from localStorage.
 */
function getToken() {
  return localStorage.getItem("token");
}

/**
 * Convert any value to a safe number.
 */
function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Escape HTML to prevent unsafe DOM injection.
 */
function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Format number as UGX currency string.
 */
function formatUGX(amount) {
  return "UGX " + toNumber(amount).toLocaleString("en-US");
}

/**
 * Build query string from current filter values.
 */
function buildQueryString(filters) {
  const params = new URLSearchParams();
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (filters.branch && filters.branch !== "all") params.set("branch", filters.branch);
  if (filters.category && filters.category !== "all") params.set("category", filters.category);
  return params.toString();
}

/**
 * Generic GET helper with auth header.
 */
async function fetchJson(pathWithQuery) {
  const token = getToken();
  if (!token) {
    window.location.href = "/loginform/html/login.html";
    return null;
  }

  const response = await fetch(`${API_BASE}${pathWithQuery}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    }
  });

  if (response.status === 401 || response.status === 403) {
    window.location.href = "/loginform/html/login.html";
    return null;
  }

  if (!response.ok) {
    let message = "Request failed";
    try {
      const body = await response.json();
      message = body.message || message;
    } catch (_) {
      // Keep fallback message.
    }
    throw new Error(`${pathWithQuery} -> ${response.status} ${message}`);
  }

  return response.json();
}

/**
 * Calculate value for a single sale.
 */
function getSaleValue(sale) {
  const fallback = toNumber(sale.tonnage) * toNumber(sale.pricePerKg);

  if (sale.saleType === "credit") {
    const paid = Array.isArray(sale.paymentHistory)
      ? sale.paymentHistory.reduce((sum, p) => sum + toNumber(p.amount), 0)
      : 0;
    const due = toNumber(sale.amountDue);
    return paid + due || fallback;
  }

  return toNumber(sale.amountPaid) || fallback;
}

/**
 * Get sale category field with fallback.
 */
function getSaleCategory(sale) {
  return String(sale.produceType || sale.produceName || "Uncategorized").trim() || "Uncategorized";
}

/**
 * Apply selected filters in frontend for consistency.
 */
function applyClientFilters(sales, filters) {
  return sales.filter((sale) => {
    const saleDate = String(sale.date || "");
    const saleBranch = String(sale.branch || "");
    const saleCategory = getSaleCategory(sale);

    if (filters.startDate && saleDate < filters.startDate) return false;
    if (filters.endDate && saleDate > filters.endDate) return false;
    if (filters.branch !== "all" && saleBranch !== filters.branch) return false;
    if (filters.category !== "all" && saleCategory !== filters.category) return false;
    return true;
  });
}

/**
 * Build category breakdown from filtered sales.
 */
function buildCategoryBreakdown(sales) {
  const map = {};

  sales.forEach((sale) => {
    const category = getSaleCategory(sale);
    if (!map[category]) {
      map[category] = { category, unitsSold: 0, totalRevenue: 0 };
    }

    map[category].unitsSold += toNumber(sale.tonnage);
    map[category].totalRevenue += getSaleValue(sale);
  });

  return Object.values(map).sort((a, b) => b.totalRevenue - a.totalRevenue);
}

/**
 * Render loading state in cards and table.
 */
function renderLoadingState() {
  document.getElementById("totalSalesAmount").textContent = "Loading...";
  document.getElementById("totalTransactions").textContent = "Loading...";
  document.getElementById("averageSaleValue").textContent = "Loading...";

  document.getElementById("categoryBreakdownBody").innerHTML = `
    <tr>
      <td colspan="4" style="text-align:center;color:#999;">Loading sales data...</td>
    </tr>
  `;
}

/**
 * Render error state in cards and table.
 */
function renderErrorState() {
  document.getElementById("totalSalesAmount").textContent = "--";
  document.getElementById("totalTransactions").textContent = "--";
  document.getElementById("averageSaleValue").textContent = "--";

  document.getElementById("categoryBreakdownBody").innerHTML = `
    <tr>
      <td colspan="4" style="text-align:center;color:#c62828;">Failed to load sales data</td>
    </tr>
  `;
}

/**
 * Render summary cards using calculated totals.
 */
function renderSummaryCards(totalSalesAmount, totalTransactions, averageSaleValue) {
  document.getElementById("totalSalesAmount").textContent = formatUGX(totalSalesAmount);
  document.getElementById("totalTransactions").textContent = toNumber(totalTransactions).toLocaleString("en-US");
  document.getElementById("averageSaleValue").textContent = formatUGX(averageSaleValue);
}

/**
 * Render category breakdown table rows.
 */
function renderCategoryTable(categoryBreakdown, totalSalesAmount) {
  const tbody = document.getElementById("categoryBreakdownBody");

  if (!categoryBreakdown.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center;color:#999;">No sales data available</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = categoryBreakdown
    .map((row) => {
      const pct = totalSalesAmount > 0 ? (row.totalRevenue / totalSalesAmount) * 100 : 0;
      return `
        <tr>
          <td>${escapeHtml(row.category)}</td>
          <td>${toNumber(row.unitsSold).toLocaleString("en-US")}</td>
          <td>${formatUGX(Math.round(row.totalRevenue))}</td>
          <td>${pct.toFixed(1)}%</td>
        </tr>
      `;
    })
    .join("");
}

/**
 * Fill branch and category filter options from available data.
 */
function populateFilterOptions(allSales) {
  const branchSelect = document.getElementById("branchFilter");
  const categorySelect = document.getElementById("categoryFilter");

  const currentBranch = branchSelect.value || "all";
  const currentCategory = categorySelect.value || "all";

  const branchSet = new Set();
  const categorySet = new Set();

  allSales.forEach((sale) => {
    const branch = String(sale.branch || "").trim();
    if (branch) branchSet.add(branch);

    const category = getSaleCategory(sale);
    if (category) categorySet.add(category);
  });

  branchSelect.innerHTML = `<option value="all">All Branches</option>`;
  Array.from(branchSet).sort().forEach((branch) => {
    branchSelect.innerHTML += `<option value="${escapeHtml(branch)}">${escapeHtml(branch)}</option>`;
  });

  categorySelect.innerHTML = `<option value="all">All Categories</option>`;
  Array.from(categorySet).sort().forEach((category) => {
    categorySelect.innerHTML += `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`;
  });

  branchSelect.value = Array.from(branchSet).includes(currentBranch) ? currentBranch : "all";
  categorySelect.value = Array.from(categorySet).includes(currentCategory) ? currentCategory : "all";
}

/**
 * Read current filter values from inputs.
 */
function getCurrentFilters() {
  return {
    startDate: document.getElementById("startDate").value,
    endDate: document.getElementById("endDate").value,
    branch: document.getElementById("branchFilter").value || "all",
    category: document.getElementById("categoryFilter").value || "all"
  };
}

/**
 * Load sales summary and category table from backend.
 */
async function loadSalesSummary() {
  try {
    renderLoadingState();

    const filters = getCurrentFilters();
    const query = buildQueryString(filters);
    const suffix = query ? `?${query}` : "";

    // Send selected filters as query params to backend endpoints.
    const [salesResult, creditsResult] = await Promise.allSettled([
      fetchJson(`/sales/branch${suffix}`),
      fetchJson(`/credits/all${suffix}`)
    ]);

    const sales = salesResult.status === "fulfilled" && Array.isArray(salesResult.value?.data)
      ? salesResult.value.data
      : [];

    const credits = creditsResult.status === "fulfilled" && Array.isArray(creditsResult.value?.data)
      ? creditsResult.value.data
      : [];

    // Merge records by _id to avoid duplicates.
    const mergedMap = new Map();
    [...sales, ...credits].forEach((sale) => {
      if (sale && sale._id) mergedMap.set(String(sale._id), sale);
    });
    const allSales = Array.from(mergedMap.values());

    // Update filter dropdown options based on live data.
    populateFilterOptions(allSales);

    // Apply filters in frontend to keep behavior reliable.
    const filteredSales = applyClientFilters(allSales, filters);

    const totalSalesAmount = filteredSales.reduce((sum, sale) => sum + getSaleValue(sale), 0);
    const totalTransactions = filteredSales.length;
    const averageSaleValue = totalTransactions > 0 ? totalSalesAmount / totalTransactions : 0;
    const categoryBreakdown = buildCategoryBreakdown(filteredSales);

    renderSummaryCards(
      Math.round(totalSalesAmount),
      totalTransactions,
      Math.round(averageSaleValue)
    );
    renderCategoryTable(categoryBreakdown, totalSalesAmount);
  } catch (error) {
    console.error("Failed to load director sales summary:", error);
    renderErrorState();
  }
}

/**
 * Set up page event handlers and initial load.
 */
function setupPage() {
  const token = getToken();
  if (!token) {
    window.location.href = "/loginform/html/login.html";
    return;
  }

  document.getElementById("applyFiltersBtn").addEventListener("click", loadSalesSummary);
  loadSalesSummary();
}

document.addEventListener("DOMContentLoaded", setupPage);

