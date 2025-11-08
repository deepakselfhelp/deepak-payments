// ✅ /api/mollie/webhook.js — Dual Telegram Notifications (Payment + Subscription)
export default async function handler(req, res) {
  try {
    const MOLLIE_KEY = process.env.MOLLIE_SECRET_KEY;
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    const body = req.body;
    const paymentId = body.id || body.paymentId;

    console.log("📬 Mollie webhook received:", paymentId);

    // ✅ Fetch full payment info
    const paymentRes = await fetch(`https://api.mollie.com/v2/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MOLLIE_KEY}` },
    });
    const payment = await paymentRes.json();

    if (!payment || !payment.id) {
      console.error("❌ Invalid payment payload:", payment);
      return res.status(400).send("Bad request");
    }

    const email = payment.metadata?.email || payment.customerEmail || "N/A";
    const name = payment.metadata?.name || "Unknown";
    const amount = payment.amount?.value || "0.00";
    const currency = payment.amount?.currency || "EUR";
    const customerId = payment.customerId;
    const sequence = payment.sequenceType;
    const status = payment.status;
    const planType = payment.metadata?.planType || "DID Main Subscription";

    async function sendTelegram(text) {
      if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
      try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text,
            parse_mode: "Markdown",
          }),
        });
      } catch (err) {
        console.error("⚠️ Telegram send failed:", err);
      }
    }

    // 💰 FIRST PAYMENT (step 1: payment completed)
    if (status === "paid" && sequence === "first") {
      await sendTelegram(
        `🏦 *Source:* Mollie\n💰 *Initial Payment Completed*\n📧 *Email:* ${email}\n👤 *Name:* ${name}\n💵 *Amount:* ${currency} ${amount}\n🧾 *Customer ID:* ${customerId}\n📦 *Plan:* ${planType}`
      );

      // step 2: now create subscription
      const subRes = await fetch(
        `https://api.mollie.com/v2/customers/${customerId}/subscriptions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${MOLLIE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: { value: "29.00", currency: "EUR" },
            interval: "1 month",
            description: planType,
            metadata: { email, name },
          }),
        }
      );

      const subscription = await subRes.json();
      console.log("✅ Subscription created:", subscription.id || subscription);

      // step 3: notify subscription creation
      await sendTelegram(
        `🎉 *Subscription Started Successfully*\n📧 *Email:* ${email}\n👤 *Name:* ${name}\n🧾 *Subscription ID:* ${subscription.id || "N/A"}\n🆔 *Customer ID:* ${customerId}\n📦 *Plan:* ${planType}`
      );
    }

    // 🔁 RECURRING PAYMENT
    else if (status === "paid" && sequence === "recurring") {
      await sendTelegram(
        `🔁 *Subscription Renewal Charged*\n📧 *Email:* ${email}\n💵 *Amount:* ${currency} ${amount}\n🧾 *Customer ID:* ${customerId}`
      );
    }

    // ⚠️ FAILED PAYMENT
    else if (status === "failed") {
      await sendTelegram(
        `⚠️ *Payment Failed*\n📧 *Email:* ${email}\n💵 *Amount:* ${currency} ${amount}\n🧾 *Customer ID:* ${customerId}`
      );
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Mollie Webhook Error:", err);
    res.status(500).send("Internal error");
  }
}
