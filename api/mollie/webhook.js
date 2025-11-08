// ✅ /api/webhook.js
export default async function handler(req, res) {
  try {
    const MOLLIE_KEY = process.env.MOLLIE_SECRET_KEY;
    const body = req.body;

    // Mollie sometimes sends only payment id in the body
    const paymentId = body.id || body.resourceId || body.paymentId;
    console.log("📬 Mollie webhook received:", paymentId);

    // 1️⃣ Fetch full payment details
    const pay = await fetch(`https://api.mollie.com/v2/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MOLLIE_KEY}` },
    });
    const payment = await pay.json();

    if (payment.status === "paid" && payment.sequenceType === "oneoff") {
      const { name, email, recurringAmount } = payment.metadata;
      const customerId = payment.customerId;

      // 2️⃣ Create subscription (first time only)
      const subRes = await fetch(
        `https://checkout.realcoachdeepak.com/api/create-subscription`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerId, amount: recurringAmount }),
        }
      );
      const subscription = await subRes.json();

      // 3️⃣ Notify Telegram
      const msg = `🏦 *Mollie Payment Successful*\n📧 ${email}\n💶 €${payment.amount.value}\n🧾 Customer: ${customerId}\n🔁 Subscription: ${subscription.id}`;
      await sendTelegram(msg);
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ error: err.message });
  }
}

async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text }),
  });
}
