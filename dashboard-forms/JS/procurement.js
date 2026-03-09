const API_BASE_URL = window.API_URL || "https://kgl-project-3g6j.onrender.com";

const FARM_CONTACTS = {
  "Maganjo Farm": "0700000001",
  "Matugga Farm": "0700000002"
};

let procurementForm;
let formErrors;
let supplierSelect;
let supplierOtherGroup;
let supplierOtherInput;
let supplierContactInput;
let purchaseDateInput;
let produceTimeInput;
let productNameInput;
let productCategoryInput;
let quantityInput;
let unitPriceInput;
let sellingPriceInput;
let lastPriceEdited = "unit";

document.addEventListener("DOMContentLoaded", function () {
  procurementForm = document.querySelector(".form-box");
  formErrors = document.getElementById("formErrors");
  supplierSelect = document.getElementById("supplier-select");
  supplierOtherGroup = document.getElementById("supplier-other-group");
  supplierOtherInput = document.getElementById("supplier-name-other");
  supplierContactInput = document.getElementById("supplier-contact");
  purchaseDateInput = document.getElementById("purchase-date");
  produceTimeInput = document.getElementById("produce-time");
  productNameInput = document.getElementById("product-name");
  productCategoryInput = document.getElementById("product-category");
  quantityInput = document.getElementById("quantity");
  unitPriceInput = document.getElementById("unit-price");
  sellingPriceInput = document.getElementById("selling-price");

  if (!procurementForm) {
    return;
  }

  setTodayAsPurchaseDate();
  updateSupplierFields();
  setupSupplierEvents();
  setupCalculationEvents();
  setupValidationEvents();
  procurementForm.addEventListener("submit", handleFormSubmit);
});

function setTodayAsPurchaseDate() {
  if (!purchaseDateInput) {
    return;
  }

  purchaseDateInput.value = new Date().toISOString().split("T")[0];
}

function getSupplierName() {
  if (!supplierSelect) {
    return "";
  }

  if (supplierSelect.value === "Other") {
    return supplierOtherInput.value.trim();
  }

  return supplierSelect.value.trim();
}

function updateSupplierFields() {
  if (!supplierSelect || !supplierContactInput) {
    return;
  }

  const selectedSupplier = supplierSelect.value;
  const isOtherSupplier = selectedSupplier === "Other";

  supplierOtherGroup.classList.toggle("hidden", !isOtherSupplier);

  if (isOtherSupplier) {
    supplierOtherInput.required = true;
    supplierContactInput.readOnly = false;
    if (Object.values(FARM_CONTACTS).indexOf(supplierContactInput.value) !== -1) {
      supplierContactInput.value = "";
    }
    return;
  }

  supplierOtherInput.required = false;
  supplierOtherInput.value = "";

  if (FARM_CONTACTS[selectedSupplier]) {
    supplierContactInput.value = FARM_CONTACTS[selectedSupplier];
    supplierContactInput.readOnly = true;
  } else {
    supplierContactInput.readOnly = false;
  }
}

function setupSupplierEvents() {
  if (!supplierSelect) {
    return;
  }

  supplierSelect.addEventListener("change", function () {
    updateSupplierFields();
    refreshErrors();
  });

  supplierOtherInput.addEventListener("input", refreshErrors);
  supplierContactInput.addEventListener("input", refreshErrors);
}

function setupCalculationEvents() {
  if (!quantityInput || !unitPriceInput || !sellingPriceInput) {
    return;
  }

  quantityInput.addEventListener("input", function () {
    if (lastPriceEdited === "selling") {
      updateUnitPriceFromSellingPrice();
    } else {
      updateSellingPriceFromUnitPrice();
    }
    refreshErrors();
  });

  unitPriceInput.addEventListener("input", function () {
    lastPriceEdited = "unit";
    updateSellingPriceFromUnitPrice();
    refreshErrors();
  });

  sellingPriceInput.addEventListener("input", function () {
    lastPriceEdited = "selling";
    updateUnitPriceFromSellingPrice();
    refreshErrors();
  });
}

function updateSellingPriceFromUnitPrice() {
  const quantity = Number(quantityInput.value);
  const unitPrice = Number(unitPriceInput.value);

  if (!quantity || !unitPrice) {
    return;
  }

  sellingPriceInput.value = (quantity * unitPrice).toFixed(2);
}

function updateUnitPriceFromSellingPrice() {
  const quantity = Number(quantityInput.value);
  const sellingPrice = Number(sellingPriceInput.value);

  if (!quantity || !sellingPrice) {
    return;
  }

  unitPriceInput.value = (sellingPrice / quantity).toFixed(2);
}

function setupValidationEvents() {
  const fields = [
    purchaseDateInput,
    produceTimeInput,
    productNameInput,
    productCategoryInput,
    quantityInput,
    unitPriceInput,
    sellingPriceInput,
    document.getElementById("branch")
  ];

  fields.forEach(function (field) {
    if (!field) {
      return;
    }

    field.addEventListener("input", refreshErrors);
    field.addEventListener("change", refreshErrors);
  });
}

function showMessages(messages, type) {
  if (!formErrors) {
    return;
  }

  if (!messages || !messages.length) {
    formErrors.className = "error-container";
    formErrors.innerHTML = "";
    return;
  }

  formErrors.className = "error-container " + type;
  formErrors.innerHTML =
    "<ul>" +
    messages
      .map(function (message) {
        return "<li>" + escapeHtml(message) + "</li>";
      })
      .join("") +
    "</ul>";
}

function refreshErrors() {
  if (!formErrors || !formErrors.innerHTML.trim()) {
    return;
  }

  showMessages(validateForm(), "error");
}

function validateForm() {
  const errors = [];
  const supplierName = getSupplierName();
  const supplierContact = supplierContactInput.value.trim();
  const productName = productNameInput.value.trim();
  const productCategory = productCategoryInput.value.trim();
  const quantity = Number(quantityInput.value);
  const unitPrice = unitPriceInput.value.trim();
  const sellingPrice = sellingPriceInput.value.trim();

  const supplierPattern = /^[A-Za-z0-9 .,'&-]{2,}$/;
  const productPattern = /^[A-Za-z0-9 .,'&-]{2,}$/;
  const categoryPattern = /^[A-Za-z ]{2,}$/;
  const phonePattern = /^[0-9+]{10,15}$/;

  if (!supplierSelect.value) {
    errors.push("Please select a supplier.");
  } else if (!supplierName) {
    errors.push("Please enter the supplier name.");
  } else if (!supplierPattern.test(supplierName)) {
    errors.push("Supplier name must contain valid letters or numbers.");
  }

  if (!supplierContact) {
    errors.push("Please provide the supplier contact.");
  } else if (!phonePattern.test(supplierContact)) {
    errors.push("Please provide a valid contact phone number.");
  }

  if (!purchaseDateInput.value) {
    errors.push("Purchase date is required.");
  }

  if (!produceTimeInput.value) {
    errors.push("Produce time is required.");
  }

  if (!productName) {
    errors.push("Product name is required.");
  } else if (!productPattern.test(productName)) {
    errors.push("Product name must contain valid letters or numbers.");
  }

  if (!productCategory) {
    errors.push("Product category is required.");
  } else if (!categoryPattern.test(productCategory)) {
    errors.push("Product category must contain letters only.");
  }

  if (!quantityInput.value) {
    errors.push("Quantity is required.");
  } else if (Number.isNaN(quantity) || quantity < 1000) {
    errors.push("Quantity must be at least 1000kg.");
  }

  if (!unitPrice && !sellingPrice) {
    errors.push("Enter a unit price or a selling price.");
  }

  if (unitPrice && (Number.isNaN(Number(unitPrice)) || Number(unitPrice) < 5)) {
    errors.push("Price must not be less than 5.");
  }

  if (sellingPrice && (Number.isNaN(Number(sellingPrice)) || Number(sellingPrice) < 5)) {
    errors.push("Price must not be less than 5.");
  }

  return errors;
}

function buildProcurementPayload() {
  const supplierName = getSupplierName();
  const quantity = Number(quantityInput.value);
  const unitPrice = Number(unitPriceInput.value);
  const sellingPrice = Number(sellingPriceInput.value);

  let finalUnitPrice = unitPrice;
  let finalSellingPrice = sellingPrice;

  if (!finalSellingPrice && quantity && finalUnitPrice) {
    finalSellingPrice = quantity * finalUnitPrice;
  }

  if (!finalUnitPrice && quantity && finalSellingPrice) {
    finalUnitPrice = finalSellingPrice / quantity;
  }

  if (finalUnitPrice && !unitPriceInput.value.trim()) {
    unitPriceInput.value = finalUnitPrice.toFixed(2);
  }

  if (finalSellingPrice && !sellingPriceInput.value.trim()) {
    sellingPriceInput.value = finalSellingPrice.toFixed(2);
  }

  return {
    supplier_name: supplierName,
    supplier_contact: supplierContactInput.value.trim(),
    purchase_date: purchaseDateInput.value,
    produce_time: produceTimeInput.value,
    invoice_number: createInvoiceNumber(),
    product_name: productNameInput.value.trim(),
    product_category: productCategoryInput.value.trim(),
    quantity: quantity,
    unit_price: finalUnitPrice,
    selling_price: finalSellingPrice,
    payment_method: "",
    payment_status: ""
  };
}

function createInvoiceNumber() {
  return "PROC-" + Date.now();
}

async function handleFormSubmit(event) {
  event.preventDefault();

  const errors = validateForm();
  if (errors.length) {
    showMessages(errors, "error");
    return;
  }

  const token = localStorage.getItem("token");
  if (!token) {
    showMessages(["Please login first."], "error");
    window.location.href = "../../loginform/html/login.html";
    return;
  }

  try {
    const response = await fetch(API_BASE_URL + "/procurement", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify(buildProcurementPayload())
    });

    const result = await response.json();

    if (!response.ok) {
      showMessages([result.message || "Failed to submit procurement form."], "error");
      return;
    }

    showMessages(["Procurement record created successfully."], "success");
    procurementForm.reset();
    lastPriceEdited = "unit";
    setTodayAsPurchaseDate();
    updateSupplierFields();

    setTimeout(function () {
      window.location.href = "../html/managersDashboard.html";
    }, 2000);
  } catch (error) {
    showMessages([error.message || "Error submitting procurement form."], "error");
  }
}

async function fetchProcurementRecords() {
  try {
    const token = localStorage.getItem("token");
    if (!token) {
      return [];
    }

    const response = await fetch(API_BASE_URL + "/procurement", {
      method: "GET",
      headers: {
        Authorization: "Bearer " + token
      }
    });

    if (!response.ok) {
      throw new Error("Failed to fetch procurement records");
    }

    const result = await response.json();
    return result.data || [];
  } catch (error) {
    console.error("Error fetching procurement records:", error);
    return [];
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    fetchProcurementRecords
  };
}
