"use strict";

const API_BASE_URL = window.API_URL || "https://kgl-project-3g6j.onrender.com";

let activeView = "credit";
let creditSales = [];
let cashSales = [];

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

function escapeHtml(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

document.addEventListener("DOMContentLoaded", async function () {
  const token = getToken();
  const currentUser = token ? decodeToken(token) : null;

  if (!token || !currentUser) {
    window.location.href = "../../loginform/html/login.html";
    return;
  }

  if (currentUser.role !== "Manager" && currentUser.role !== "Sales-agent") {
    window.location.href = "../../loginform/html/login.html";
    return;
  }

  renderSidebar(currentUser);
  setupViewControls();
  renderLoadingState();

  try {
    await loadSalesData(currentUser);
    renderActiveView();
  } catch (error) {
    renderErrorState(error.message || "Could not load sales records.");
  }
});

function renderSidebar(currentUser) {
  const navMenu = document.getElementById("navMenu");
  if (!navMenu) {
    return;
  }

  const items =
    currentUser.role === "Manager"
      ? [
          { href: "./managersDashboard.html", icon: "fa-home", label: "Overview" },
          { href: "./managergosell.html", icon: "fa-store", label: "Go Sell" },
          { href: "./salesmanagement.html", icon: "fa-receipt", label: "Sales Management", active: true },
          { href: "./managersProcurement.html", icon: "fa-cart-plus", label: "Procurement" },
          { href: "./statistics.html", icon: "fa-chart-bar", label: "Statistics" },
          { href: "./pricing.html", icon: "fa-tags", label: "Pricing" },
          { href: "./usermanagement.html", icon: "fa-users", label: "User Management" },
          { href: "./managersProfile.html", icon: "fa-user", label: "Profile" },
          { href: "#", icon: "fa-sign-out-alt", label: "Logout", id: "logout-btn" }
        ]
      : [
          { href: "./sellersDashboard.html", icon: "fa-tachometer-alt", label: "Dashboard" },
          { href: "./profile.html", icon: "fa-user", label: "Profile" },
          { href: "./goSell.html", icon: "fa-store", label: "Go Sell" },
          { href: "./salesmanagement.html", icon: "fa-receipt", label: "Sales Management", active: true },
          { href: "#", icon: "fa-sign-out-alt", label: "Logout", id: "logout-btn" }
        ];

  navMenu.innerHTML = items
    .map(function (item) {
      return (
        "<li>" +
        '<a href="' +
        item.href +
        '"' +
        (item.active ? ' class="active"' : "") +
        (item.id ? ' id="' + item.id + '"' : "") +
        ">" +
        '<i class="fas ' +
        item.icon +
        '"></i>' +
        "<span>" +
        item.label +
        "</span>" +
        "</a>" +
        "</li>"
      );
    })
    .join("");
}

function setupViewControls() {
  const creditButton = document.getElementById("viewCredit");
  const cashButton = document.getElementById("viewCash");

  creditButton.addEventListener("click", function () {
    activeView = "credit";
    renderActiveView();
  });

  cashButton.addEventListener("click", function () {
    activeView = "cash";
    renderActiveView();
  });
}

async function loadSalesData(currentUser) {
  const token = getToken();
  const cashEndpoint = currentUser.role === "Manager" ? "/sales/branch" : "/sales/history";
  const creditEndpoint = "/credits/all";

  const [cashResponse, creditResponse] = await Promise.all([
    fetch(API_BASE_URL + cashEndpoint, {
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }
    }),
    fetch(API_BASE_URL + creditEndpoint, {
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }
    })
  ]);

  if (
    cashResponse.status === 401 ||
    cashResponse.status === 403 ||
    creditResponse.status === 401 ||
    creditResponse.status === 403
  ) {
    window.location.href = "../../loginform/html/login.html";
    throw new Error("Unauthorized");
  }

  if (!cashResponse.ok || !creditResponse.ok) {
    throw new Error("Failed to load sales records.");
  }

  const cashBody = await cashResponse.json();
  const creditBody = await creditResponse.json();
  const userBranch = currentUser.branch || "";

  cashSales = filterBranchSales(cashBody.data || [], userBranch).filter(function (sale) {
    return sale.saleType === "cash";
  });

  creditSales = filterBranchSales(creditBody.data || [], userBranch).filter(function (sale) {
    return sale.saleType === "credit";
  });

  cashSales.sort(compareSalesNewestFirst);
  creditSales.sort(compareSalesNewestFirst);
}

function filterBranchSales(records, branch) {
  if (!branch) {
    return records.slice();
  }

  return records.filter(function (record) {
    return String(record.branch || "").trim() === String(branch).trim();
  });
}

function compareSalesNewestFirst(a, b) {
  const first = (a.date || "") + " " + (a.time || "");
  const second = (b.date || "") + " " + (b.time || "");
  return second.localeCompare(first);
}

function renderActiveView() {
  toggleViewButtons();
  toggleCreditAction();

  if (activeView === "credit") {
    renderCreditTable();
    updateCount(creditSales.length, "credit");
    toggleEmptyState(creditSales.length === 0);
    return;
  }

  renderCashTable();
  updateCount(cashSales.length, "cash");
  toggleEmptyState(cashSales.length === 0);
}

function toggleViewButtons() {
  document.getElementById("viewCredit").classList.toggle("active", activeView === "credit");
  document.getElementById("viewCash").classList.toggle("active", activeView === "cash");
}

function toggleCreditAction() {
  const actionBar = document.getElementById("creditActionBar");
  if (!actionBar) {
    return;
  }

  actionBar.hidden = activeView !== "credit";
}

function renderLoadingState() {
  const head = document.getElementById("salesManagementHead");
  const body = document.getElementById("salesManagementBody");
  const emptyState = document.getElementById("salesManagementEmpty");

  head.innerHTML = "";
  body.innerHTML =
    '<tr class="loading-row"><td colspan="9" class="text-center">Loading sales records...</td></tr>';
  emptyState.classList.add("no-results--hidden");
}

function renderErrorState(message) {
  const head = document.getElementById("salesManagementHead");
  const body = document.getElementById("salesManagementBody");
  const emptyState = document.getElementById("salesManagementEmpty");

  head.innerHTML = "";
  body.innerHTML =
    '<tr class="error-row"><td colspan="9" class="text-center">' +
    escapeHtml(message) +
    "</td></tr>";
  emptyState.classList.add("no-results--hidden");
  document.getElementById("salesManagementCount").textContent = "";
}

function renderCreditTable() {
  const head = document.getElementById("salesManagementHead");
  const body = document.getElementById("salesManagementBody");

  head.innerHTML =
    "<tr>" +
    "<th>Buyer</th>" +
    "<th>NIN</th>" +
    "<th>Location</th>" +
    "<th>Contact</th>" +
    "<th>Amount Due</th>" +
    "<th>Produce</th>" +
    "<th>Sales Agent</th>" +
    "<th>Due Date</th>" +
    "<th>Dispatch Date</th>" +
    "</tr>";

  if (!creditSales.length) {
    body.innerHTML = "";
    return;
  }

  body.innerHTML = creditSales
    .map(function (sale) {
      return (
        "<tr>" +
        "<td>" +
        escapeHtml(sale.buyerName || "-") +
        "</td>" +
        "<td>" +
        escapeHtml(sale.NationalID || "-") +
        "</td>" +
        "<td>" +
        escapeHtml(sale.location || "-") +
        "</td>" +
        "<td>" +
        escapeHtml(sale.contact || "-") +
        "</td>" +
        "<td>" +
        "UGX " +
        formatCurrency(sale.amountDue || 0) +
        "</td>" +
        "<td>" +
        escapeHtml(sale.produceName || "-") +
        "</td>" +
        "<td>" +
        escapeHtml(getAgentName(sale)) +
        "</td>" +
        "<td>" +
        escapeHtml(formatDate(sale.dueDate)) +
        "</td>" +
        "<td>" +
        escapeHtml(formatDate(sale.dispatchDate)) +
        "</td>" +
        "</tr>"
      );
    })
    .join("");
}

function renderCashTable() {
  const head = document.getElementById("salesManagementHead");
  const body = document.getElementById("salesManagementBody");

  head.innerHTML =
    "<tr>" +
    "<th>Produce</th>" +
    "<th>Quantity</th>" +
    "<th>Amount Paid</th>" +
    "<th>Buyer</th>" +
    "<th>Sales Agent</th>" +
    "<th>Date/Time</th>" +
    "</tr>";

  if (!cashSales.length) {
    body.innerHTML = "";
    return;
  }

  body.innerHTML = cashSales
    .map(function (sale) {
      return (
        "<tr>" +
        "<td>" +
        escapeHtml(sale.produceName || "-") +
        "</td>" +
        "<td>" +
        formatNumber(sale.tonnage || 0) +
        " kg</td>" +
        "<td>" +
        "UGX " +
        formatCurrency(sale.amountPaid || 0) +
        "</td>" +
        "<td>" +
        escapeHtml(sale.buyerName || "-") +
        "</td>" +
        "<td>" +
        escapeHtml(getAgentName(sale)) +
        "</td>" +
        "<td>" +
        escapeHtml(formatDateTime(sale)) +
        "</td>" +
        "</tr>"
      );
    })
    .join("");
}

function toggleEmptyState(showEmpty) {
  const emptyState = document.getElementById("salesManagementEmpty");
  emptyState.classList.toggle("no-results--hidden", !showEmpty);
}

function updateCount(count, type) {
  const label = type === "credit" ? "credit sale" : "cash sale";
  document.getElementById("salesManagementCount").textContent =
    count + " " + label + (count !== 1 ? "s" : "");
}

function getAgentName(sale) {
  if (sale.recordedBy && sale.recordedBy.name) {
    return sale.recordedBy.name;
  }

  return sale.salesAgent || "-";
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function formatDateTime(sale) {
  const date = formatDate(sale.date);
  const time = sale.time || "-";
  return date + " " + time;
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

function formatNumber(value) {
  return Math.round(Number(value || 0)).toLocaleString("en-US");
}
