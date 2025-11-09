// ✅ /api/mollie/webhook.js — Final Version with Retry Logging + Telegram
export default async function handler(req, res) {
  try {
    const MOLLIE_KEY = process.env.MOLLIE_SECRET_KEY;
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    const body = req.body;
    const paymentId = body.id || body.paymentId;

    console.log("📬 Mollie webhook received:", paymentId);
    console.log("🔁 Delivery attempt headers:", {
      "X-Mollie-Request-Id": req.headers["x-mollie-request-id"],
      "X-Mollie-Signature": req.headers["x-mollie-signature"],
      "X-Forwarded-For": req.headers["x-forwarded-for"],
    });

    // ✅ Get full payment details
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
    const sequence = payment.sequenceType; // "first" or "recurring"
    const status = payment.status;
    const planType = payment.metadata?.planType || "DID Main Subscription";

    // Helper for Telegram
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

    // 💰 FIRST payment (create subscription)
    if (status === "paid" && sequence === "first") {
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

      await sendTelegram(
        `🏦 *Source:* Mollie\n💰 *New Subscription Started*\n📧 *Email:* ${email}\n👤 *Name:* ${name}\n💵 *Amount:* ${currency} ${amount}\n🧾 *Subscription ID:* ${subscription.id || "N/A"}\n🆔 *Customer ID:* ${customerId}`
      );
    }

    // 🔁 Recurring renewal
    else if (status === "paid" && sequence === "recurring") {
      await sendTelegram(
        `🔁 *Subscription Renewal Charged*\n📧 *Email:* ${email}\n💵 *Amount:* ${currency} ${amount}\n🧾 *Customer ID:* ${customerId}`
      );
    }

    // ⚠️ Payment failed
    else if (status === "failed") {
      await sendTelegram(
        `⚠️ *Payment Failed*\n📧 *Email:* ${email}\n💵 *Amount:* ${currency} ${amount}\n🧾 *Customer ID:* ${customerId}`
      );
    }

    // 💤 Fallback for unhandled states
    else {
      console.log(`ℹ️ Payment status: ${status}, sequence: ${sequence}`);
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Mollie Webhook Error:", err);
    res.status(500).send("Internal error");
  }
}
