const API_BASE = window.API_URL || "https://kgl-project-3g6j.onrender.com";

let products = [];
let creditProducts = [];
let catalog = [];
let catalogByName = {};

document.addEventListener("DOMContentLoaded", async () => {
  const token = getToken();
  const decodedToken = token ? decodeToken(token) : null;
  const userName = decodedToken ? decodedToken.name : "";
  const currentUser = decodedToken || null;

  // Temporary debug logs
  console.log("[NAV DEBUG] currentUser:", currentUser);
  console.log("[NAV DEBUG] currentUser.role:", currentUser ? currentUser.role : null);

  if (!token || !userName) {
    alert("Session expired. Please log in again.");
    window.location.href = "/loginform/html/login.html";
    return;
  }

  document.getElementById("cash-sales-agent").value = userName;
  document.getElementById("cash-sales-agent").readOnly = true;
  document.getElementById("credit-sales-agent").value = userName;
  document.getElementById("credit-sales-agent").readOnly = true;

  wireFormEvents();
  showForm("cash");

  try {
    await loadLiveCatalog();
    preselectFromQuery();
  } catch (err) {
    alert("Failed to load branch products. Please refresh.");
  }
});

function wireFormEvents() {
  const cashForm = document.getElementById("cash-form");
  const creditForm = document.getElementById("credit-form");

  cashForm.addEventListener("submit", handleCashSubmit);
  creditForm.addEventListener("submit", handleCreditSubmit);

  document.getElementById("product-name").addEventListener("change", syncCashSelection);
  document.getElementById("quantity").addEventListener("input", syncCashSelection);
  document.getElementById("produce-name-credit").addEventListener("blur", syncCreditSelection);
  document.getElementById("credit-tonnage").addEventListener("input", syncCreditSelection);

  document.getElementById("unit-price").readOnly = true;
  document.getElementById("credit-unit-price").readOnly = true;
  document.getElementById("amount-due").readOnly = true;
}

async function loadLiveCatalog() {
  const token = getToken();
  const [pricingRes, inventoryRes] = await Promise.all([
    fetch(`${API_BASE}/api/pricing`, {
      headers: { Authorization: `Bearer ${token}` }
    }),
    fetch(`${API_BASE}/api/inventory`, {
      headers: { Authorization: `Bearer ${token}` }
    })
  ]);

  if (
    pricingRes.status === 401 ||
    pricingRes.status === 403 ||
    inventoryRes.status === 401 ||
    inventoryRes.status === 403
  ) {
    window.location.href = "/loginform/html/login.html";
    throw new Error("Unauthorized");
  }

  if (!pricingRes.ok || !inventoryRes.ok) {
    throw new Error("Failed to load catalog");
  }

  const pricingData = await pricingRes.json();
  const inventoryData = await inventoryRes.json();

  const inventoryMap = (inventoryData.items || []).reduce((acc, item) => {
    acc[normalizeName(item.itemName)] = item;
    return acc;
  }, {});

  catalog = (pricingData.products || [])
    .map((p) => {
      const inv = inventoryMap[normalizeName(p.productName)];
      return {
        name: p.productName,
        category: p.produceType || "General",
        price: p.sellingPrice,
        stockKg: inv ? Number(inv.stockKg || 0) : 0
      };
    })
    .filter((item) => item.price !== null && item.price !== undefined);

  catalogByName = catalog.reduce((acc, item) => {
    acc[normalizeName(item.name)] = item;
    return acc;
  }, {});

  populateCashProductSelect();
}

function populateCashProductSelect() {
  const select = document.getElementById("product-name");
  select.innerHTML = '<option value="">-- Select Product --</option>';

  catalog.forEach((item) => {
    const disabled = item.stockKg <= 0 ? "disabled" : "";
    select.insertAdjacentHTML(
      "beforeend",
      `<option value="${escapeAttr(item.name)}" ${disabled}>${escapeHtml(item.name)} (${item.stockKg}kg)</option>`
    );
  });
}

function preselectFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const product = params.get("product");
  if (!product) return;

  const select = document.getElementById("product-name");
  const match = catalog.find((p) => normalizeName(p.name) === normalizeName(product));
  if (match) {
    select.value = match.name;
    syncCashSelection();
  }
}

function syncCashSelection() {
  const selectedName = document.getElementById("product-name").value;
  const qty = Number(document.getElementById("quantity").value || 0);
  const item = catalogByName[normalizeName(selectedName)];

  if (!item) {
    document.getElementById("product-category").value = "";
    document.getElementById("unit-price").value = "";
    return;
  }

  document.getElementById("product-category").value = item.category;
  document.getElementById("unit-price").value = item.price;

  if (qty > item.stockKg) {
    alert(`Only ${item.stockKg} kg available for ${item.name}.`);
    document.getElementById("quantity").value = item.stockKg > 0 ? item.stockKg : "";
  }
}

function syncCreditSelection() {
  const name = document.getElementById("produce-name-credit").value.trim();
  const qty = Number(document.getElementById("credit-tonnage").value || 0);
  const item = catalogByName[normalizeName(name)];

  if (!item) {
    document.getElementById("produce-type-credit").value = "";
    document.getElementById("credit-unit-price").value = "";
    return;
  }

  document.getElementById("produce-name-credit").value = item.name;
  document.getElementById("produce-type-credit").value = item.category;
  document.getElementById("credit-unit-price").value = item.price;

  if (qty > item.stockKg) {
    alert(`Only ${item.stockKg} kg available for ${item.name}.`);
    document.getElementById("credit-tonnage").value = item.stockKg > 0 ? item.stockKg : "";
  }
}

function showForm(type) {
  document.getElementById("cash-form").style.display = type === "cash" ? "grid" : "none";
  document.getElementById("credit-form").style.display = type === "credit" ? "grid" : "none";
}

function addProduct() {
  const name = document.getElementById("product-name").value;
  const item = catalogByName[normalizeName(name)];
  const qty = Number(document.getElementById("quantity").value);

  if (!item) {
    alert("Please select a valid product from branch catalog.");
    return;
  }
  if (!qty || qty <= 0) {
    alert("Please enter a valid quantity.");
    return;
  }
  if (qty > item.stockKg) {
    alert(`Insufficient stock. Available: ${item.stockKg} kg.`);
    return;
  }

  const total = qty * item.price;
  products.push({ name: item.name, category: item.category, qty, price: item.price, total });
  renderProducts();

  document.getElementById("product-name").value = "";
  document.getElementById("product-category").value = "";
  document.getElementById("quantity").value = "";
  document.getElementById("unit-price").value = "";
}

function renderProducts() {
  const list = document.getElementById("product-list");
  const totalsum = document.getElementById("grand-total");
  list.innerHTML = "";
  let grandtotal = 0;

  products.forEach((p, index) => {
    grandtotal += Number(p.total);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(p.name)}</td>
      <td>${escapeHtml(p.category)}</td>
      <td>${p.qty}</td>
      <td>${p.price}</td>
      <td>${p.total}</td>
      <td><button class="btn-remove" onclick="removeProduct(${index})">remove</button></td>
    `;
    list.appendChild(tr);
  });

  totalsum.textContent = grandtotal.toFixed(2);
}

function removeProduct(index) {
  products.splice(index, 1);
  renderProducts();
}

function addProductCredit() {
  const name = document.getElementById("produce-name-credit").value.trim();
  const item = catalogByName[normalizeName(name)];
  const qty = Number(document.getElementById("credit-tonnage").value);

  if (!item) {
    alert("Product not found in this branch catalog.");
    return;
  }
  if (!qty || qty <= 0) {
    alert("Please enter a valid tonnage.");
    return;
  }
  if (qty > item.stockKg) {
    alert(`Insufficient stock. Available: ${item.stockKg} kg.`);
    return;
  }

  const total = qty * item.price;
  creditProducts.push({ name: item.name, category: item.category, qty, price: item.price, total });
  renderCreditProducts();

  document.getElementById("produce-name-credit").value = "";
  document.getElementById("produce-type-credit").value = "";
  document.getElementById("credit-tonnage").value = "";
  document.getElementById("credit-unit-price").value = "";
}

function renderCreditProducts() {
  const list = document.getElementById("credit-product-list");
  const totalsum = document.getElementById("credit-grand-total");
  list.innerHTML = "";
  let grandtotal = 0;

  creditProducts.forEach((p, index) => {
    grandtotal += Number(p.total);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(p.name)}</td>
      <td>${escapeHtml(p.category)}</td>
      <td>${p.qty}</td>
      <td>${p.price}</td>
      <td>${p.total}</td>
      <td><button class="btn-remove" onclick="removeCreditProduct(${index})">remove</button></td>
    `;
    list.appendChild(tr);
  });

  totalsum.textContent = grandtotal.toFixed(2);
  document.getElementById("amount-due").value = grandtotal.toFixed(2);
}

function removeCreditProduct(index) {
  creditProducts.splice(index, 1);
  renderCreditProducts();
}

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

async function postSale(payload) {
  const token = getToken();
  try {
    console.log("[NAV DEBUG] postSale called with payload:", payload);
    console.log("[NAV DEBUG] Authorization header present:", !!token);

    const res = await fetch(`${API_BASE}/sales`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {})
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || "Request failed");
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function getCurrentUser() {
  const token = getToken();
  const decoded = token ? decodeToken(token) : null;

  // Temporary debug logs
  console.log("[NAV DEBUG] getCurrentUser() ->", decoded);
  console.log("[NAV DEBUG] getCurrentUser().role ->", decoded ? decoded.role : null);

  return decoded;
}

function getGoSellRouteForRole(currentUser) {
  const role = currentUser ? currentUser.role : null;

  // Manager should always return to manager Go Sell page.
  if (role === "Manager") {
    return "/Dashbord forms/html/managergosell.html";
  }

  // Sales-agent should always return to sales-agent Go Sell page.
  if (role === "Sales-agent") {
    return "/Dashbord forms/html/goSell.html";
  }

  // Safe fallback for unknown roles.
  return "/loginform/html/login.html";
}

function navigateToRoleGoSell(currentUser) {
  const route = getGoSellRouteForRole(currentUser);

  // Temporary debug logs
  console.log("[NAV DEBUG] navigation function called: navigateToRoleGoSell");
  console.log("[NAV DEBUG] currentUser:", currentUser);
  console.log("[NAV DEBUG] currentUser.role:", currentUser ? currentUser.role : null);
  console.log("[NAV DEBUG] route being navigated to:", route);

  window.location.href = route;
}

async function handleCashSubmit(e) {
  e.preventDefault();
  if (products.length === 0) {
    alert("Add at least one product");
    return;
  }

  const saleDate = document.getElementById("sale-date").value;
  const buyer = document.getElementById("customer-name").value;
  const phone = document.getElementById("customer-phone").value;

  const decodedToken = decodeToken(getToken());
  const salesAgent = decodedToken ? decodedToken.name : "Unknown";

  let successCount = 0;
  let failCount = 0;

  for (const product of products) {
    const payload = {
      saleType: "cash",
      produceName: product.name,
      produceType: product.category,
      tonnage: Number(product.qty),
      buyerName: buyer || null,
      salesAgentName: salesAgent,
      date: saleDate || new Date().toISOString().split("T")[0],
      time: new Date().toLocaleTimeString(),
      nationalId: null,
      location: null,
      contacts: phone || null,
      dueDate: null,
      dispatchDate: null
    };

    const res = await postSale(payload);
    if (res.ok) successCount++;
    else failCount++;
  }

  if (failCount === 0) {
    alert(`All ${successCount} products recorded successfully`);
    const currentUser = getCurrentUser();
    navigateToRoleGoSell(currentUser);
  } else {
    alert(`Recorded ${successCount} products, ${failCount} failed`);
  }
}

async function handleCreditSubmit(e) {
  e.preventDefault();

  const buyer = document.getElementById("buyer-name").value;
  const nationalId = document.getElementById("national-id").value;
  const location = document.getElementById("credit-location").value;
  const contacts = document.getElementById("credit-contacts").value;
  const dueDate = document.getElementById("credit-due-date").value;
  const dispatchDate = document.getElementById("dispatch-date").value;

  if (!buyer || !nationalId) {
    alert("Buyer name and NIN required");
    return;
  }
  if (creditProducts.length === 0) {
    alert("Add at least one product");
    return;
  }

  const decodedToken = decodeToken(getToken());
  const salesAgent = decodedToken ? decodedToken.name : "Unknown";

  let successCount = 0;
  let failCount = 0;

  for (const product of creditProducts) {
    const payload = {
      saleType: "credit",
      produceName: product.name,
      produceType: product.category,
      tonnage: Number(product.qty),
      buyerName: buyer,
      salesAgentName: salesAgent || null,
      date: new Date().toISOString().split("T")[0],
      time: new Date().toLocaleTimeString(),
      nationalId,
      location,
      contacts,
      dueDate,
      dispatchDate
    };

    const res = await postSale(payload);
    if (res.ok) successCount++;
    else failCount++;
  }

  if (failCount === 0) {
    alert(`All ${successCount} products recorded successfully`);
    const currentUser = getCurrentUser();
    navigateToRoleGoSell(currentUser);
  } else {
    alert(`Recorded ${successCount} products, ${failCount} failed`);
  }
}

function normalizeName(name) {
  return String(name || "").trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

