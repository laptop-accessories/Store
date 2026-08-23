const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const UNIT_PRICE = 25;
const SHIPPING = 0;
const MIN_QTY = 1;
const MAX_QTY = 20;

app.use(express.json({ limit: '20kb' }));
app.use(express.static(__dirname));

function cleanPhone(value = '') {
  return String(value).replace(/[^0-9+]/g, '').replace(/^\+216/, '').replace(/^00216/, '');
}

function validTunisianMobile(value) {
  return /^[2459]\d{7}$/.test(cleanPhone(value));
}

function normalizeQuantity(value) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return MIN_QTY;
  return Math.min(MAX_QTY, Math.max(MIN_QTY, n));
}

function buildOrderMessage(data) {
  const note = data.note?.trim() ? data.note.trim() : 'لا توجد ملاحظة';
  return [
    '🛒 طلب جديد من متجر رافع اللابتوب',
    '',
    `📦 المنتج: رافع لابتوب — طقم من قطعتين`,
    `🔢 الكمية: ${data.quantity} طقم`,
    `💵 سعر المنتجات: ${data.subtotal} د.ت`,
    `🚚 التوصيل: مجاني`,
    `💰 المجموع الكلي: ${data.total} د.ت`,
    '',
    `👤 الاسم: ${data.name}`,
    `📞 الهاتف: ${data.phone}`,
    `📍 الولاية: ${data.state}`,
    `🏠 العنوان: ${data.address}`,
    `📝 ملاحظة: ${note}`,
    '',
    '💳 الدفع: عند الاستلام'
  ].join('\n');
}

app.post('/api/order', async (req, res) => {
  const { name, phone, state, address, note = '', quantity = 1 } = req.body || {};

  if (!name || !phone || !state || !address) {
    return res.status(400).json({ ok: false, error: 'يرجى إكمال جميع المعلومات المطلوبة.' });
  }

  const normalizedPhone = cleanPhone(phone);
  if (!validTunisianMobile(normalizedPhone)) {
    return res.status(400).json({ ok: false, error: 'رقم الهاتف غير صحيح.' });
  }

  const qty = normalizeQuantity(quantity);
  const subtotal = qty * UNIT_PRICE;
  const total = subtotal + SHIPPING;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.error('Missing Telegram environment variables.');
    return res.status(500).json({ ok: false, error: 'إعدادات الإشعارات غير مكتملة على الخادم.' });
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text: buildOrderMessage({
      name,
      phone: normalizedPhone,
      state,
      address,
      note,
      quantity: qty,
      subtotal,
      shipping: SHIPPING,
      total
    })
  };

  try {
    const tgResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const tgData = await tgResponse.json().catch(() => ({}));
    if (!tgResponse.ok || !tgData.ok) {
      console.error('Telegram API error:', tgData);
      return res.status(502).json({ ok: false, error: 'تعذر إرسال إشعار الطلب. حاول مرة أخرى.' });
    }

    return res.json({ ok: true, messageId: tgData?.result?.message_id || null });
  } catch (error) {
    console.error('Order notification error:', error);
    return res.status(500).json({ ok: false, error: 'حدث خطأ في الخادم. حاول مرة أخرى.' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Laptop Riser Store running on http://localhost:${PORT}`);
});
