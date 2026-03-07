/**
 * creditsform.js - Credit Payment Processing
 *
 * Flow:
 *  1. User enters one search value (name / NIN / phone / location / product)
 *  2. Frontend calls GET /credits/search?query=...
 *  3. First matching credit sale is displayed
 *  4. User records payment using PATCH /credits/:id/pay
 */

"use strict";

const API_BASE = window.API_URL || "https://kgl-project-3g6j.onrender.com";

function getToken() {
  return localStorage.getItem("token");
}

let currentSale = null;

function showCreditMessage(message, type = "error") {
  const box = document.getElementById("alert-box");
  box.className = `alert alert-${type}`;
  box.textContent = message;
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function clearAlert() {
  const box = document.getElementById("alert-box");
  box.className = "alert hidden";
  box.textContent = "";
}

async function readJsonSafely(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getResponseMessage(response, body, fallback) {
  if (body && typeof body.message === "string" && body.message.trim()) {
    return body.message;
  }

  if (response.status === 403) {
    return "This credit belongs to another branch and cannot be updated.";
  }

  if (response.status >= 500) {
    return "Server error. Please try again later.";
  }

  return fallback;
}

function show(id) {
  document.getElementById(id).classList.remove("hidden");
}

function hide(id) {
  document.getElementById(id).classList.add("hidden");
}

function fmt(num) {
  if (num === null || num === undefined) return "-";
  return Number(num).toLocaleString("en-UG", { minimumFractionDigits: 0 });
}

function fmtDate(str) {
  if (!str) return "-";
  return str;
}

function computeTotalPaid(sale) {
  return (sale.paymentHistory || []).reduce((sum, entry) => sum + (entry.amount || 0), 0);
}

function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderHistory(entries) {
  const tbody = document.getElementById("history-body");
  document.getElementById("history-count").textContent = entries.length;

  if (!entries.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="no-data">No payments yet</td></tr>';
    return;
  }

  tbody.innerHTML = entries
    .map(
      (entry, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escHtml(fmtDate(entry.date))}</td>
          <td>UGX ${fmt(entry.amount)}</td>
          <td>${escHtml(entry.recordedBy?.name || String(entry.recordedBy || "Unknown"))}</td>
        </tr>`
    )
    .join("");
}

function renderDetails(sale) {
  document.getElementById("d-customer").textContent = sale.buyerName || "-";
  document.getElementById("d-nin").textContent = sale.NationalID || "-";
  document.getElementById("d-phone").textContent = sale.contact || "-";
  document.getElementById("d-location").textContent = sale.location || "-";

  document.getElementById("d-product").textContent = sale.produceName || "-";
  document.getElementById("d-tonnage").textContent = sale.tonnage ? `${sale.tonnage} kg` : "-";
  document.getElementById("d-date").textContent = fmtDate(sale.date);
  document.getElementById("d-duedate").textContent = fmtDate(sale.dueDate);

  const totalPaid = computeTotalPaid(sale);
  const original = totalPaid + (sale.amountDue || 0);

  document.getElementById("d-original").textContent = `UGX ${fmt(original)}`;
  document.getElementById("d-totalpaid").textContent = `UGX ${fmt(totalPaid)}`;
  document.getElementById("d-amountdue").textContent = `UGX ${fmt(sale.amountDue)}`;

  const pct = original > 0 ? Math.min((totalPaid / original) * 100, 100) : 0;
  document.getElementById("progress-fill").style.width = `${pct.toFixed(1)}%`;
  document.getElementById("progress-label").textContent = `${pct.toFixed(1)}% paid`;

  const badge = document.getElementById("status-badge");
  const status = sale.status || "pending";
  badge.textContent = status;
  badge.className = `badge badge-${status}`;

  renderHistory(sale.paymentHistory || []);

  document.getElementById("max-hint").textContent = `Maximum: UGX ${fmt(sale.amountDue)}`;

  show("details-card");

  if (status === "paid" || (sale.amountDue || 0) <= 0) {
    hide("payment-card");
    show("paid-card");
  } else {
    show("payment-card");
    hide("paid-card");
  }
}

function updateBalanceUI(newAmountDue, newStatus, paymentAmount) {
  if (!currentSale) return;

  currentSale.amountDue = newAmountDue;
  currentSale.status = newStatus;
  currentSale.paymentHistory = currentSale.paymentHistory || [];
  currentSale.paymentHistory.push({
    amount: paymentAmount,
    date: new Date().toISOString().split("T")[0],
    recordedBy: null
  });

  const totalPaid = computeTotalPaid(currentSale);
  const original = totalPaid + newAmountDue;
  const pct = original > 0 ? Math.min((totalPaid / original) * 100, 100) : 100;

  document.getElementById("d-totalpaid").textContent = `UGX ${fmt(totalPaid)}`;
  document.getElementById("d-amountdue").textContent = `UGX ${fmt(newAmountDue)}`;
  document.getElementById("progress-fill").style.width = `${pct.toFixed(1)}%`;
  document.getElementById("progress-label").textContent = `${pct.toFixed(1)}% paid`;
  document.getElementById("max-hint").textContent = `Maximum: UGX ${fmt(newAmountDue)}`;

  const badge = document.getElementById("status-badge");
  badge.textContent = newStatus;
  badge.className = `badge badge-${newStatus}`;

  renderHistory(currentSale.paymentHistory);

  if (newStatus === "paid") {
    hide("payment-card");
    show("paid-card");
  }
}

// Search credits with one flexible input.
async function searchCredit() {
  clearAlert();

  const searchTerm = document.getElementById("search-id").value.trim();

  // Input validation for empty search.
  if (!searchTerm) {
    showCreditMessage("Please enter a name, NIN, phone, location, or product to search.", "error");
    return;
  }

  const token = getToken();
  if (!token) {
    showCreditMessage("Session expired. Please log in again.", "error");
    setTimeout(() => {
      window.location.href = "../../loginform/html/login.html";
    }, 1200);
    return;
  }

  const btn = document.getElementById("btn-search");
  btn.disabled = true;
  btn.textContent = "Searching...";

  try {
    const res = await fetch(`${API_BASE}/credits/search?query=${encodeURIComponent(searchTerm)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const body = await readJsonSafely(res);

    if (!res.ok) {
      currentSale = null;
      hide("details-card");
      hide("payment-card");
      hide("paid-card");
      showCreditMessage(getResponseMessage(res, body, "No credit records found."), "error");
      return;
    }

    const records = Array.isArray(body.data) ? body.data : [];

    if (!records.length) {
      currentSale = null;
      hide("details-card");
      hide("payment-card");
      hide("paid-card");
      showCreditMessage("No credit records found for your search.", "error");
      return;
    }

    // Show the first result to keep UI beginner-friendly.
    currentSale = records[0];
    renderDetails(currentSale);

    document.getElementById("payment-amount").value = "";
    document.getElementById("payment-form").reset();

    if (records.length > 1) {
      showCreditMessage(`Found ${records.length} matching credit records. Showing the most recent one.`, "success");
    } else {
      showCreditMessage("Credit record found.", "success");
    }
  } catch (error) {
    showCreditMessage("Network error. Please try again.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Search";
  }
}

async function submitPayment(event) {
  event.preventDefault();
  clearAlert();

  if (!currentSale) {
    showCreditMessage("No credit record loaded. Please search first.", "error");
    return;
  }

  const rawAmount = document.getElementById("payment-amount").value;
  const amount = Number(rawAmount);

  if (!rawAmount || isNaN(amount) || amount <= 0) {
    showCreditMessage("Payment amount must be greater than 0.", "error");
    return;
  }

  if (amount > currentSale.amountDue) {
    showCreditMessage(`Overpayment not allowed. Maximum is UGX ${fmt(currentSale.amountDue)}.`, "error");
    return;
  }

  const token = getToken();
  if (!token) {
    showCreditMessage("Session expired. Please log in again.", "error");
    setTimeout(() => {
      window.location.href = "../../loginform/html/login.html";
    }, 1200);
    return;
  }

  const btn = document.getElementById("btn-pay");
  btn.disabled = true;
  btn.textContent = "Processing...";

  try {
    const res = await fetch(`${API_BASE}/credits/${currentSale._id}/pay`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ paymentAmount: amount })
    });

    const body = await readJsonSafely(res);

    if (!res.ok) {
      showCreditMessage(getResponseMessage(res, body, "Payment failed."), "error");
      return;
    }

    showCreditMessage(getResponseMessage(res, body, "Payment recorded."), "success");
    updateBalanceUI(body.amountDue, body.status, amount);
    document.getElementById("payment-amount").value = "";
  } catch (error) {
    showCreditMessage("Network error. Please try again.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Confirm Payment";
  }
}

function resetPage() {
  currentSale = null;
  clearAlert();
  document.getElementById("search-id").value = "";
  hide("details-card");
  hide("payment-card");
  hide("paid-card");
  document.getElementById("payment-amount").value = "";
}

document.addEventListener("DOMContentLoaded", () => {
  const token = getToken();
  if (!token) {
    window.location.href = "../../loginform/html/login.html";
    return;
  }

  document.getElementById("search-id").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      searchCredit();
    }
  });
});

