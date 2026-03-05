// Base API URL - Update this to match your backend server URL
const API_BASE_URL = window.API_URL || "https://kgl-project-3g6j.onrender.com"; // Must match the port your backend is running on

// Form elements will be initialized after DOM is ready
let procurementForm;
let supplierNameInput;
let supplierContactInput;
let purchaseDateInput;
let produceTimeInput;
let invoiceNumberInput;
let productNameInput;
let productCategoryInput;
let quantityInput;
let unitPriceInput;
let sellingPriceInput;
let totalAmountInput; // legacy alias, will point to sellingPriceInput

// Initialize form elements when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  procurementForm = document.querySelector('.form-box');
  supplierNameInput = document.getElementById('supplier-name');
  supplierContactInput = document.getElementById('supplier-contact');
  purchaseDateInput = document.getElementById('purchase-date');
  produceTimeInput = document.getElementById('produce-time');
  invoiceNumberInput = document.getElementById('invoice-number');
  productNameInput = document.getElementById('product-name');
  productCategoryInput = document.getElementById('product-category');
  quantityInput = document.getElementById('quantity');
  unitPriceInput = document.getElementById('unit-price');
  sellingPriceInput = document.getElementById('selling-price');
  // backwards compatibility alias
  totalAmountInput = sellingPriceInput;

  // Add form submission handler
  if (procurementForm) {
    procurementForm.addEventListener('submit', handleFormSubmit);
  }

  // Setup auto-calculation
  if (quantityInput && unitPriceInput && totalAmountInput) {
    const calculateTotal = () => {
      const quantity = parseFloat(quantityInput.value) || 0;
      const unitPrice = parseFloat(unitPriceInput.value) || 0;
      const total = quantity * unitPrice;
      totalAmountInput.value = total.toFixed(2);
    };

    quantityInput.addEventListener('change', calculateTotal);
    unitPriceInput.addEventListener('change', calculateTotal);
    quantityInput.addEventListener('input', calculateTotal);
    unitPriceInput.addEventListener('input', calculateTotal);
  }
});

// Form submission handler
async function handleFormSubmit(e) {
  e.preventDefault();
  console.log('Form submitted');
  
  try {
    // Get payment method
    const paymentMethodRadios = document.querySelectorAll('input[name="payment"]');
    let paymentMethod = '';
    for (let radio of paymentMethodRadios) {
      if (radio.checked) {
        paymentMethod = radio.value || radio.parentElement.textContent.trim();
        break;
      }
    }

    // Get payment status
    const paymentStatusRadios = document.querySelectorAll('input[name="payment_status"]');
    let paymentStatus = '';
    for (let radio of paymentStatusRadios) {
      if (radio.checked) {
        paymentStatus = radio.value;
        break;
      }
    }

    // Validate required fields with rules
    const namePattern = /^[A-Za-z0-9 ]+$/;
    const typePattern = /^[A-Za-z ]{2,}$/;
    const dealerPattern = /^[A-Za-z0-9 ]{2,}$/;
    const phonePattern = /^[0-9+]{10,15}$/;

    if (!supplierNameInput.value || !namePattern.test(supplierNameInput.value)) {
      showAlert('Supplier name must be alphanumeric and at least 1 character', 'error');
      return;
    }
    if (!supplierContactInput.value || !phonePattern.test(supplierContactInput.value)) {
      showAlert('Please provide a valid contact phone number', 'error');
      return;
    }
    if (!purchaseDateInput.value) {
      showAlert('Purchase date is required', 'error');
      return;
    }
    if (!produceTimeInput.value) {
      showAlert('Produce time is required', 'error');
      return;
    }
    if (!invoiceNumberInput.value) {
      showAlert('Invoice number is required', 'error');
      return;
    }
    if (!productNameInput.value || !namePattern.test(productNameInput.value)) {
      showAlert('Product/produce name must be alphanumeric', 'error');
      return;
    }
    if (!productCategoryInput.value || !typePattern.test(productCategoryInput.value)) {
      showAlert('Produce type must be alphabetic and at least 2 characters', 'error');
      return;
    }
    if (!quantityInput.value || isNaN(quantityInput.value) || parseInt(quantityInput.value) < 100) {
      showAlert('Tonnage must be numeric and at least 3 digits (>=100)', 'error');
      return;
    }
    if (!unitPriceInput.value || isNaN(unitPriceInput.value) || parseFloat(unitPriceInput.value) < 10000) {
      showAlert('Cost must be numeric and at least 5 digits (>=10000)', 'error');
      return;
    }
    // Branch is not validated client-side — it is enforced server-side from JWT.

    // Calculate selling price if empty
    let sellingPrice = sellingPriceInput.value;
    if (!sellingPrice || sellingPrice === 0) {
      sellingPrice = parseFloat(quantityInput.value) * parseFloat(unitPriceInput.value);
    }

    // FIXED (LOGIC-03 / BRANCH-01): Branch is no longer sent from the client.
    // The server reads branch from the JWT (req.user.branch), so including it here
    // would be redundant and could allow branch spoofing if the server were misconfigured.
    const formData = {
      supplier_name: supplierNameInput.value,
      supplier_contact: supplierContactInput.value,
      purchase_date: purchaseDateInput.value,
      produce_time: produceTimeInput.value,
      invoice_number: invoiceNumberInput.value,
      product_name: productNameInput.value,
      product_category: productCategoryInput.value || '',
      quantity: parseFloat(quantityInput.value),
      unit_price: parseFloat(unitPriceInput.value),
      selling_price: parseFloat(sellingPrice),
      payment_method: paymentMethod,
      payment_status: paymentStatus
    };

    const token = localStorage.getItem('token');
    if (!token) {
      showAlert('Please login first', 'error');
      window.location.href = '../../loginform/html/login.html';
      return;
    }

    const response = await fetch(`${API_BASE_URL}/procurement`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(formData)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Failed to submit procurement form');
    }

    showAlert('Procurement record created successfully!', 'success');

    // Reset form
    procurementForm.reset();

    // Optional: Redirect to dashboard after successful submission
    setTimeout(() => {
      window.location.href = '../html/managersDashboard.html';
    }, 2000);

  } catch (error) {
    console.error('Error submitting procurement form:', error);
    showAlert(error.message || 'Error submitting procurement form', 'error');
  }
}

// Alert function to show messages to user
function showAlert(message, type = 'info') {
  // Create alert container
  const alertContainer = document.createElement('div');
  alertContainer.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    border-radius: 4px;
    font-weight: 500;
    z-index: 1000;
    animation: slideIn 0.3s ease-in-out;
    max-width: 400px;
  `;

  // Set color based on alert type
  const colors = {
    success: '#4CAF50',
    error: '#f44336',
    info: '#2196F3',
    warning: '#ff9800'
  };

  const textColor = '#fff';
  const backgroundColor = colors[type] || colors.info;

  alertContainer.style.backgroundColor = backgroundColor;
  alertContainer.style.color = textColor;
  alertContainer.textContent = message;

  // Add CSS animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(400px);
        opacity: 0;
      }
    }
  `;
  
  if (!document.querySelector('style[data-alert]')) {
    style.setAttribute('data-alert', 'true');
    document.head.appendChild(style);
  }

  document.body.appendChild(alertContainer);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    alertContainer.style.animation = 'slideOut 0.3s ease-in-out';
    setTimeout(() => {
      alertContainer.remove();
    }, 300);
  }, 3000);
}

// Fetch and display procurement records (optional - for viewing submitted records)
async function fetchProcurementRecords() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return;

    const response = await fetch(`${API_BASE_URL}/procurement`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error('Failed to fetch procurement records');

    const result = await response.json();
    return result.data;

  } catch (error) {
    console.error('Error fetching procurement records:', error);
  }
}

// Export functions for use in other files if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    fetchProcurementRecords,
    showAlert
  };
}

