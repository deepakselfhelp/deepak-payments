// ✅ /api/webhook.js
export default async function handler(req, res) {
  try {
    const MOLLIE_KEY = process.env.MOLLIE_SECRET_KEY;
    const body = req.body;
    const paymentId = body.id || body.resourceId || body.paymentId;

    console.log("📬 Mollie webhook received:", paymentId);

    // 1️⃣ Fetch payment details
    const pay = await fetch(`https://api.mollie.com/v2/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MOLLIE_KEY}` },
    });
    const payment = await pay.json();

    const email = payment.metadata?.email || "N/A";
    const name = payment.metadata?.name || "N/A";
    const customerId = payment.customerId;
    const amount = payment.amount?.value || "0.00";
    const planType = payment.metadata?.planType || "Unknown Plan";

    if (payment.status === "paid" && payment.sequenceType === "oneoff") {
      console.log(`✅ Initial payment success for ${email}`);

      // 2️⃣ Create subscription
      const subRes = await fetch(
        `https://checkout.realcoachdeepak.com/api/create-subscription`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId,
            amount: payment.metadata?.recurringAmount || amount,
            planType,
          }),
        }
      );
      const subscription = await subRes.json();

      // 3️⃣ Notify Telegram
      const msg = `🏦 *Source:* Mollie
💰 *Initial Payment Successful*
📧 *Email:* ${email}
👤 *Name:* ${name}
💵 *Amount:* €${amount}
🧾 *Customer ID:* ${customerId}
🔁 *Subscription:* ${subscription.id || "Created"}
`;
      await sendTelegram(msg);
    }

    // 4️⃣ Handle failed/canceled payments
    if (payment.status === "failed" || payment.status === "canceled") {
      const msg = `⚠️ *Mollie Payment Failed or Cancelled*
📧 ${email}
💶 €${amount}
❌ Status: ${payment.status}`;
      await sendTelegram(msg);
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("❌ Mollie webhook error:", err);
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
    body: JSON.stringify({
      chat_id: chat,
      text,
      parse_mode: "Markdown",
    }),
  });
}
