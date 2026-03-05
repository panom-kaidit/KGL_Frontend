const API_BASE_URL = window.API_URL || "https://kgl-project-3g6j.onrender.com";

let allSales = [];
let salesSortDirection = "desc";
let saleTypeFilter = "all";

function escHtml(str) {
  return String(str === null || str === undefined ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function decodeToken(token) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

function normalizeName(name) {
  return String(name || "").trim().toLowerCase();
}

document.addEventListener("DOMContentLoaded", function () {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "/loginform/html/login.html";
    return;
  }

  setupControls();
  loadGoSellProducts();
  loadSalesForCurrentRole();
});

async function loadGoSellProducts() {
  const grid = document.getElementById("product-grid");
  if (!grid) return;

  const token = localStorage.getItem("token");
  try {
    grid.innerHTML = '<p style="padding:16px;color:#666;">Loading products...</p>';

    const [pricingRes, inventoryRes] = await Promise.all([
      fetch(API_BASE_URL + "/api/pricing", {
        headers: { Authorization: "Bearer " + token }
      }),
      fetch(API_BASE_URL + "/api/inventory", {
        headers: { Authorization: "Bearer " + token }
      })
    ]);

    if (
      pricingRes.status === 401 ||
      pricingRes.status === 403 ||
      inventoryRes.status === 401 ||
      inventoryRes.status === 403
    ) {
      window.location.href = "/loginform/html/login.html";
      return;
    }

    if (!pricingRes.ok) throw new Error("Pricing error " + pricingRes.status);
    if (!inventoryRes.ok) throw new Error("Inventory error " + inventoryRes.status);

    const pricingData = await pricingRes.json();
    const inventoryData = await inventoryRes.json();

    const pricingProducts = pricingData.products || [];
    const inventoryItems = inventoryData.items || [];
    const inventoryByName = inventoryItems.reduce((acc, item) => {
      acc[normalizeName(item.itemName)] = item;
      return acc;
    }, {});

    const merged = pricingProducts.map((p) => {
      const inv = inventoryByName[normalizeName(p.productName)] || null;
      const availableKg = inv ? Number(inv.stockKg || 0) : 0;
      return {
        productName: p.productName,
        sellingPrice: p.sellingPrice,
        hasPricing: p.sellingPrice !== null && p.sellingPrice !== undefined,
        availableKg
      };
    });

    if (merged.length === 0) {
      grid.innerHTML =
        '<p style="padding:16px;color:#888;">No products available for this branch.</p>';
      return;
    }

    grid.innerHTML = merged
      .map(function (item) {
        const priceReady = item.hasPricing;
        const stockReady = item.availableKg > 0;
        const canSell = priceReady && stockReady;

        const priceText = priceReady
          ? "UGX " + Number(item.sellingPrice).toLocaleString() + " / Kg"
          : "Price not set";
        const stockText =
          "Available: " + Number(item.availableKg).toLocaleString() + " Kg";
        const reason = !priceReady
          ? "Manager must set selling price first"
          : !stockReady
          ? "Out of stock"
          : "";

        return (
          '<div class="product--card">' +
          "<h4>" +
          escHtml(item.productName) +
          "</h4>" +
          "<p><strong>Price:</strong> " +
          escHtml(priceText) +
          "</p>" +
          "<p><strong>" +
          escHtml(stockText) +
          "</strong></p>" +
          '<a href="/Dashbord forms/html/salesform.html?product=' +
          encodeURIComponent(item.productName) +
          '">' +
          '<button ' +
          (canSell ? "" : 'disabled title="' + escHtml(reason) + '"') +
          ">Sell</button>" +
          "</a>" +
          "</div>"
        );
      })
      .join("");
  } catch (err) {
    console.error("Failed to load GoSell products:", err);
    grid.innerHTML =
      '<p style="padding:16px;color:#c62828;">Could not load products. Please refresh.</p>';
  }
}

function setupControls() {
  const searchInput = document.getElementById("salesSearchInput");
  const clearBtn = document.getElementById("clearSalesSearch");
  const sortDescBtn = document.getElementById("salesSortDesc");
  const sortAscBtn = document.getElementById("salesSortAsc");
  const filterAll = document.getElementById("filterAll");
  const filterCash = document.getElementById("filterCash");
  const filterCredit = document.getElementById("filterCredit");
  if (!searchInput) return;

  searchInput.addEventListener("input", function () {
    clearBtn.style.display = searchInput.value ? "block" : "none";
    applyFilters();
  });
  clearBtn.addEventListener("click", function () {
    searchInput.value = "";
    clearBtn.style.display = "none";
    applyFilters();
  });
  sortDescBtn.addEventListener("click", function () {
    salesSortDirection = "desc";
    sortDescBtn.classList.add("active");
    sortAscBtn.classList.remove("active");
    applyFilters();
  });
  sortAscBtn.addEventListener("click", function () {
    salesSortDirection = "asc";
    sortAscBtn.classList.add("active");
    sortDescBtn.classList.remove("active");
    applyFilters();
  });
  filterAll.addEventListener("click", function () {
    saleTypeFilter = "all";
    setActiveTypeBtn(filterAll);
    applyFilters();
  });
  filterCash.addEventListener("click", function () {
    saleTypeFilter = "cash";
    setActiveTypeBtn(filterCash);
    applyFilters();
  });
  filterCredit.addEventListener("click", function () {
    saleTypeFilter = "credit";
    setActiveTypeBtn(filterCredit);
    applyFilters();
  });
}

function setActiveTypeBtn(activeBtn) {
  ["filterAll", "filterCash", "filterCredit"].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove("active");
  });
  activeBtn.classList.add("active");
}

function applyFilters() {
  const rawQuery = document.getElementById("salesSearchInput").value.trim();
  const safeQuery = rawQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = safeQuery ? new RegExp(safeQuery, "i") : null;

  let filtered = allSales;
  if (saleTypeFilter !== "all") {
    filtered = filtered.filter(function (s) {
      return s.saleType === saleTypeFilter;
    });
  }
  if (pattern) {
    filtered = filtered.filter(function (sale) {
      const agentName =
        sale.recordedBy && sale.recordedBy.name ? sale.recordedBy.name : sale.salesAgent || "";
      const haystack = [
        sale.produceName,
        sale.produceType,
        sale.saleType,
        sale.buyerName,
        sale.contact,
        sale.location,
        agentName,
        sale.date,
        sale.time
      ].join(" ");
      return pattern.test(haystack);
    });
  }
  filtered = filtered.slice().sort(function (a, b) {
    const da = (a.date || "") + " " + (a.time || "");
    const db = (b.date || "") + " " + (b.time || "");
    return salesSortDirection === "desc" ? db.localeCompare(da) : da.localeCompare(db);
  });
  updateResultCount(filtered.length, allSales.length);
  displaySales(filtered);
}

function updateResultCount(shown, total) {
  const el = document.getElementById("salesResultCount");
  if (!el) return;
  el.textContent =
    shown === total
      ? total + " record" + (total !== 1 ? "s" : "")
      : "Showing " + shown + " of " + total + " records";
}

async function loadSalesForCurrentRole() {
  try {
    const token = localStorage.getItem("token");
    const user = decodeToken(token);
    const endpoint =
      user && user.role === "Sales-agent" ? "/sales/history" : "/sales/branch";

    const response = await fetch(API_BASE_URL + endpoint, {
      method: "GET",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }
    });

    if (response.status === 401 || response.status === 403) {
      if (endpoint === "/sales/branch") {
        allSales = [];
        applyFilters();
        return;
      }
      window.location.href = "/loginform/html/login.html";
      return;
    }
    if (!response.ok) throw new Error("Failed to fetch sales: " + response.status);

    const result = await response.json();
    allSales = result.data || [];
    applyFilters();
  } catch (error) {
    console.error("Error loading sales:", error);
    const tbody = document.getElementById("salesTableBody");
    if (tbody) {
      tbody.innerHTML =
        '<tr class="error-row"><td colspan="11" class="text-center">Error loading sales. Please try again.</td></tr>';
    }
  }
}

function displaySales(sales) {
  const tableBody = document.getElementById("salesTableBody");
  const noResults = document.getElementById("salesNoResults");
  if (!sales || sales.length === 0) {
    if (tableBody) tableBody.innerHTML = "";
    if (noResults) noResults.classList.remove("no-results--hidden");
    return;
  }
  if (noResults) noResults.classList.add("no-results--hidden");

  tableBody.innerHTML = sales
    .map(function (sale) {
      const isCash = sale.saleType === "cash";
      const amount = isCash ? formatCurrency(sale.amountPaid || 0) : formatCurrency(sale.amountDue || 0);
      const typeBadge = isCash
        ? '<span class="badge cash">Cash</span>'
        : '<span class="badge credit">Credit</span>';
      const statusBadge = isCash
        ? '<span class="badge cash">Paid</span>'
        : '<span class="badge credit">Due</span>';
      const agentName = escHtml(
        sale.recordedBy && sale.recordedBy.name ? sale.recordedBy.name : sale.salesAgent || "-"
      );
      return (
        "<tr>" +
        "<td>" +
        escHtml(formatDate(sale.date)) +
        "</td>" +
        "<td>" +
        escHtml(sale.time || "-") +
        "</td>" +
        "<td>" +
        escHtml(sale.produceName || "-") +
        "</td>" +
        "<td>" +
        escHtml(sale.produceType || "-") +
        "</td>" +
        "<td>" +
        formatNumber(sale.tonnage || 0) +
        " kg</td>" +
        "<td>" +
        typeBadge +
        "</td>" +
        "<td>" +
        amount +
        "</td>" +
        "<td>" +
        escHtml(sale.buyerName || "-") +
        "</td>" +
        "<td>" +
        escHtml(sale.contact || "-") +
        "</td>" +
        "<td>" +
        agentName +
        "</td>" +
        "<td>" +
        statusBadge +
        "</td>" +
        "</tr>"
      );
    })
    .join("");
}

function formatDate(ds) {
  if (!ds) return "-";
  return new Date(ds).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}
function formatNumber(num) {
  return Math.round(num).toLocaleString("en-US");
}
function formatCurrency(num) {
  return Number(num).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

