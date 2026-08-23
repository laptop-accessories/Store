const UNIT_PRICE = 25;
const SHIPPING = 0;
const MIN_QTY = 1;
const MAX_QTY = 20;

// Cloudflare Worker endpoint
const WORKER_URL = "https://cool-water-13c6.jfvbj.workers.dev/";

// Reveal animations (safe fallback if IntersectionObserver is unavailable)
const revealObserver = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 })
  : null;

document.querySelectorAll('.reveal').forEach((el) => {
  if (revealObserver) revealObserver.observe(el);
  else el.classList.add('active');
});

const form = document.getElementById('orderForm');
const success = document.getElementById('success');
const resetBtn = document.getElementById('resetBtn');
const submitBtn = form?.querySelector('button[type="submit"]');
const quantityInput = document.getElementById('quantity');
const decreaseQty = document.getElementById('decreaseQty');
const increaseQty = document.getElementById('increaseQty');
const subtotalValue = document.getElementById('subtotalValue');
const shippingValue = document.getElementById('shippingValue');
const totalValue = document.getElementById('totalValue');

if (!form || !success || !resetBtn || !submitBtn || !quantityInput ||
    !decreaseQty || !increaseQty || !subtotalValue || !shippingValue || !totalValue) {
  console.error('Order form elements are missing from index.html.');
}

function cleanPhone(value = '') {
  return String(value)
    .replace(/[^0-9+]/g, '')
    .replace(/^\+216/, '')
    .replace(/^00216/, '');
}

function validTunisianMobile(value) {
  const clean = cleanPhone(value);
  return /^[2459]\d{7}$/.test(clean);
}

function getQuantity() {
  let quantity = Number.parseInt(quantityInput.value, 10);
  if (!Number.isFinite(quantity)) quantity = MIN_QTY;
  return Math.min(MAX_QTY, Math.max(MIN_QTY, quantity));
}

function formatDT(value) {
  return `${Number(value).toFixed(0)} د.ت`;
}

function calculateTotals() {
  const quantity = getQuantity();
  const subtotal = quantity * UNIT_PRICE;
  const total = subtotal + SHIPPING;
  return { quantity, subtotal, shipping: SHIPPING, total };
}

function updateTotals() {
  const { quantity, subtotal, shipping, total } = calculateTotals();

  quantityInput.value = quantity;
  subtotalValue.textContent = formatDT(subtotal);
  shippingValue.textContent = formatDT(shipping);
  totalValue.textContent = formatDT(total);

  decreaseQty.disabled = quantity <= MIN_QTY;
  increaseQty.disabled = quantity >= MAX_QTY;
}

function setSubmitting(isSubmitting) {
  submitBtn.disabled = isSubmitting;
  submitBtn.textContent = isSubmitting
    ? 'جاري إرسال الطلب…'
    : '✅ إرسال الطلب';
}

quantityInput.addEventListener('input', updateTotals);
quantityInput.addEventListener('change', updateTotals);

decreaseQty.addEventListener('click', () => {
  quantityInput.value = getQuantity() - 1;
  updateTotals();
});

increaseQty.addEventListener('click', () => {
  quantityInput.value = getQuantity() + 1;
  updateTotals();
});

updateTotals();

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const data = Object.fromEntries(new FormData(form).entries());
  const quantity = getQuantity();

  if (!data.name?.trim() || !data.phone?.trim() || !data.state?.trim() || !data.address?.trim()) {
    alert('يرجى إكمال جميع المعلومات المطلوبة.');
    return;
  }

  if (!validTunisianMobile(data.phone)) {
    alert('يرجى إدخال رقم هاتف تونسي صحيح من 8 أرقام.');
    return;
  }

  const normalizedPhone = cleanPhone(data.phone);
  const productTotal = quantity * UNIT_PRICE;
  const total = productTotal + SHIPPING;

  setSubmitting(true);

  try {
    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: data.name.trim(),
        phone: normalizedPhone,
        governorate: data.state.trim(),
        address: data.address.trim(),
        note: data.note?.trim() || '',
        quantity,
        productTotal,
        delivery: SHIPPING,
        total
      })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.success !== true) {
      throw new Error(result.message || 'تعذر إرسال الطلب.');
    }

    form.hidden = true;
    success.hidden = false;
    success.scrollIntoView({ behavior: 'smooth', block: 'center' });

  } catch (error) {
    console.error('Order submission error:', error);

    let message = error?.message || 'حدث خطأ أثناء إرسال الطلب.';

    // Helpful message for browser/CORS/network failures
    if (error instanceof TypeError) {
      message = 'تعذر الاتصال بالخادم. تأكد من نشر Cloudflare Worker ومن تحديث الموقع على GitHub Pages.';
    }

    alert(message);
  } finally {
    setSubmitting(false);
  }
});

resetBtn.addEventListener('click', () => {
  form.reset();
  quantityInput.value = MIN_QTY;
  updateTotals();
  form.hidden = false;
  success.hidden = true;
  document.getElementById('order')?.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
});
