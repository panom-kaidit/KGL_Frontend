"use strict";

const API_BASE = window.API_URL || "https://kgl-project-3g6j.onrender.com";

// â”€â”€ Auth helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ XSS guard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// â”€â”€ Number formatting â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function fmt(n) {
  return Number(n).toLocaleString("en-UG");
}

// â”€â”€ Alert banner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function showAlert(message, type = "error") {
  const banner = document.getElementById("alertBanner");
  banner.textContent = message;
  banner.className = `pricing-alert ${type}`;
  banner.scrollIntoView({ behavior: "smooth", block: "nearest" });

  clearTimeout(showAlert._timer);
  showAlert._timer = setTimeout(() => {
    banner.className = "pricing-alert hidden";
  }, 5000);
}

// â”€â”€ Summary cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function updateSummaryCards(products) {
  const total   = products.length;
  const priced  = products.filter((p) => p.hasPricing).length;
  const missing = total - priced;

  document.getElementById("totalProducts").textContent  = total;
  document.getElementById("pricesSet").textContent      = priced;
  document.getElementById("pricesMissing").textContent  = missing;
}

// â”€â”€ Build one product card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function buildCard(product) {
  const {
    productName,
    produceType,
    buyingPrice,
    sellingPrice,
    hasPricing,
    updatedBy,
    lastUpdated,
  } = product;

  const hasPrice    = hasPricing && sellingPrice !== null;
  const margin      = hasPrice ? sellingPrice - buyingPrice : null;
  const marginLabel = margin !== null
    ? `<span class="margin-badge ${margin > 0 ? "positive" : "zero"}">
         Margin: UGX ${fmt(margin)} / unit
       </span>`
    : "";

  const sellingDisplay = hasPrice
    ? `<span class="price-value selling">UGX ${fmt(sellingPrice)}</span>`
    : `<span class="price-value unset">Not set</span>`;

  const auditText = hasPrice && lastUpdated
    ? `Last updated ${new Date(lastUpdated).toLocaleDateString("en-UG", {
        day: "2-digit", month: "short", year: "numeric"
      })}${updatedBy ? " by " + esc(updatedBy) : ""}`
    : "Price has not been set yet";

  const encodedName = encodeURIComponent(productName);

  return `
    <div class="product-card" id="card-${encodedName}">
      <div class="card-header">
        <span class="card-title">${esc(productName)}</span>
        <span class="category-badge">${esc(produceType || "General")}</span>
      </div>

      <div class="price-row">
        <span class="price-label">Buying Price / KG</span>
        <span class="price-value buying">UGX ${fmt(buyingPrice)}</span>
      </div>

      <div class="price-row">
        <span class="price-label">Selling Price / KG</span>
        ${sellingDisplay}
      </div>

      <div class="price-row" id="margin-row-${encodedName}">
        <span class="price-label">Profit Margin</span>
        ${marginLabel || '<span class="price-value unset">â€”</span>'}
      </div>

      <p class="audit-trail" id="audit-${encodedName}">${auditText}</p>

      <button
        class="btn btn-edit"
        onclick="toggleEdit('${encodedName}', ${buyingPrice})"
        id="edit-btn-${encodedName}"
      >
        <i class="fas fa-pencil-alt"></i> Edit Price
      </button>

      <!-- EDIT PANEL -->
      <div class="edit-panel" id="edit-panel-${encodedName}">
        <label for="price-input-${encodedName}">
          New Selling Price (UGX) â€” must be â‰¥ UGX ${fmt(buyingPrice)}
        </label>
        <input
          type="number"
          id="price-input-${encodedName}"
          min="${buyingPrice}"
          step="100"
          placeholder="e.g. ${hasPrice ? sellingPrice : buyingPrice + 5000}"
          value="${hasPrice ? sellingPrice : ""}"
        />
        <div class="edit-actions">
          <button
            class="btn btn-save"
            id="save-btn-${encodedName}"
            onclick="savePrice('${encodedName}', '${esc(productName)}', ${buyingPrice})"
          >
            <i class="fas fa-check"></i> Save
          </button>
          <button class="btn btn-cancel" onclick="cancelEdit('${encodedName}')">
            <i class="fas fa-times"></i> Cancel
          </button>
        </div>
      </div>
    </div>
  `;
}

// â”€â”€ Toggle inline edit panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function toggleEdit(encodedName, buyingPrice) {
  const panel   = document.getElementById(`edit-panel-${encodedName}`);
  const editBtn = document.getElementById(`edit-btn-${encodedName}`);
  const isOpen  = panel.classList.contains("open");

  // Close any other open panels first
  document.querySelectorAll(".edit-panel.open").forEach((p) => {
    p.classList.remove("open");
  });
  document.querySelectorAll(".btn-edit").forEach((b) => {
    b.innerHTML = '<i class="fas fa-pencil-alt"></i> Edit Price';
  });

  if (!isOpen) {
    panel.classList.add("open");
    editBtn.innerHTML = '<i class="fas fa-times"></i> Close';
    document.getElementById(`price-input-${encodedName}`).focus();
  }
}

function cancelEdit(encodedName) {
  const panel   = document.getElementById(`edit-panel-${encodedName}`);
  const editBtn = document.getElementById(`edit-btn-${encodedName}`);
  panel.classList.remove("open");
  editBtn.innerHTML = '<i class="fas fa-pencil-alt"></i> Edit Price';
}

// â”€â”€ Save price (PUT request) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function savePrice(encodedName, productName, buyingPrice) {
  const input   = document.getElementById(`price-input-${encodedName}`);
  const saveBtn = document.getElementById(`save-btn-${encodedName}`);
  const newPrice = Number(input.value);

  // â”€â”€ Client-side validation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (!input.value.trim() || isNaN(newPrice)) {
    showAlert("Please enter a valid selling price.", "error");
    input.focus();
    return;
  }

  if (newPrice <= 0) {
    showAlert("Selling price must be a positive number.", "error");
    input.focus();
    return;
  }

  if (newPrice < buyingPrice) {
    showAlert(
      `Selling price (UGX ${fmt(newPrice)}) cannot be lower than the buying price (UGX ${fmt(buyingPrice)}).`,
      "error"
    );
    input.focus();
    return;
  }

  // â”€â”€ Loading state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Savingâ€¦';

  try {
    const res = await fetch(
      `${API_BASE}/api/pricing/${encodeURIComponent(productName)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ sellingPrice: newPrice }),
      }
    );

    const data = await res.json();

    if (res.status === 401 || res.status === 403) {
      window.location.href = "/loginform/html/login.html";
      return;
    }

    if (!res.ok) {
      showAlert(data.message || "Failed to update price.", "error");
      return;
    }

    // â”€â”€ Update UI in-place without full page reload â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    updateCardInPlace(encodedName, productName, buyingPrice, data.product);
    showAlert(
      `Price for "${productName}" updated to UGX ${fmt(newPrice)} successfully.`,
      "success"
    );
    cancelEdit(encodedName);
  } catch {
    showAlert("Network error. Check your connection and try again.", "error");
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i class="fas fa-check"></i> Save';
  }
}

// â”€â”€ Patch the card's price display after a successful save â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function updateCardInPlace(encodedName, productName, buyingPrice, updatedProduct) {
  const { sellingPrice, updatedBy, updatedAt } = updatedProduct;
  const margin = sellingPrice - buyingPrice;

  // Update selling price display
  const sellingRow = document.querySelector(`#card-${encodedName} .price-row:nth-child(3) .price-label`).parentElement;
  sellingRow.querySelector(".price-value, .price-value.unset").outerHTML =
    `<span class="price-value selling">UGX ${fmt(sellingPrice)}</span>`;

  // Update margin row
  const marginRow = document.getElementById(`margin-row-${encodedName}`);
  marginRow.querySelector(":last-child").outerHTML =
    `<span class="margin-badge ${margin > 0 ? "positive" : "zero"}">Margin: UGX ${fmt(margin)} / unit</span>`;

  // Update audit trail
  const dateStr = new Date(updatedAt).toLocaleDateString("en-UG", {
    day: "2-digit", month: "short", year: "numeric",
  });
  document.getElementById(`audit-${encodedName}`).textContent =
    `Last updated ${dateStr}${updatedBy ? " by " + updatedBy : ""}`;

  // Update the input's min/value
  const input = document.getElementById(`price-input-${encodedName}`);
  if (input) input.value = sellingPrice;
}

// â”€â”€ Render entire grid â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderGrid(products) {
  const grid = document.getElementById("productGrid");

  if (!products || products.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-box-open"></i>
        <p>No products found for this branch. Add procurement records first.</p>
      </div>`;
    return;
  }

  grid.innerHTML = products.map(buildCard).join("");
}

// â”€â”€ Load pricing data from API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function loadPricing() {
  try {
    const res = await fetch(`${API_BASE}/api/pricing`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });

    if (res.status === 401 || res.status === 403) {
      window.location.href = "/loginform/html/login.html";
      return;
    }

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || `Server error ${res.status}`);
    }

    const { branch, products } = await res.json();

    document.getElementById("branchLabel").textContent =
      `Branch: ${branch}`;

    updateSummaryCards(products);
    renderGrid(products);
  } catch (err) {
    document.getElementById("productGrid").innerHTML = `
      <div class="empty-state">
        <i class="fas fa-exclamation-circle"></i>
        <p>${esc(err.message)}</p>
      </div>`;
  }
}

// â”€â”€ Boot â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
document.addEventListener("DOMContentLoaded", () => {
  const token = getToken();
  if (!token) {
    window.location.href = "/loginform/html/login.html";
    return;
  }

  const user = decodeToken(token);
  if (!user || user.role !== "Manager") {
    window.location.href = "/loginform/html/login.html";
    return;
  }

  loadPricing();
});

