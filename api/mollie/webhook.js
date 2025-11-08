// ✅ /api/mollie/webhook.js — Full Telegram Reporting (Razorpay-style)
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = req.body;
    console.log("📬 Mollie webhook received:", body.resource, body.id, body.status);

    // Escape MarkdownV2 special characters for Telegram
    const escapeMarkdownV2 = (text) =>
      text ? text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1') : "";

    // Send Telegram message
    async function sendTelegramMessage(text) {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (!botToken || !chatId) return;
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "MarkdownV2",
        }),
      });
    }

    // Extract key data safely
    const resource = body.resource || "";
    const status = body.status || "";
    const email = body.metadata?.email || "N/A";
    const name = body.metadata?.name || "N/A";
    const planType = body.metadata?.planType || "N/A";
    const customerId = body.customerId || body.customer?.id || "N/A";
    const paymentId = body.id || "N/A";
    const amount = body.amount?.value || "0.00";
    const currency = body.amount?.currency || "EUR";
    const sequenceType = body.sequenceType || "";
    const subId = body.subscriptionId || body.id || "N/A";

    // 💰 PAYMENT SUCCESS (initial)
    if (resource === "payment" && status === "paid" && sequenceType !== "recurring") {
      const msg = escapeMarkdownV2(`
🏦 *Source:* Mollie
💰 *Payment Successful*
📧 *Email:* ${email}
👤 *Name:* ${name}
📦 *Plan:* ${planType}
💵 *Amount:* ${currency} ${amount}
🆔 *Payment ID:* ${paymentId}
👤 *Customer ID:* ${customerId}
✅ *Status:* Paid
`);
      await sendTelegramMessage(msg);
      console.log(`✅ Mollie Payment Success: ${paymentId}`);

      // Auto create subscription if it’s a monthly plan
      if (planType.toLowerCase().includes("subscription")) {
        await fetch(`${process.env.BASE_URL}/api/mollie/create-subscription`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerId, amount, planType }),
        });
      }
    }

    // ⚠️ PAYMENT FAILED
    if (resource === "payment" && status === "failed") {
      const msg = escapeMarkdownV2(`
🏦 *Source:* Mollie
❌ *Payment Failed*
📧 *Email:* ${email}
👤 *Name:* ${name}
📦 *Plan:* ${planType}
💵 *Amount:* ${currency} ${amount}
🆔 *Payment ID:* ${paymentId}
`);
      await sendTelegramMessage(msg);
      console.log(`❌ Mollie Payment Failed: ${paymentId}`);
    }

    // 🔁 REBILL CHARGED
    if (resource === "payment" && sequenceType === "recurring" && status === "paid") {
      const msg = escapeMarkdownV2(`
🏦 *Source:* Mollie
🔁 *Subscription Renewal Charged*
📧 *Email:* ${email}
📦 *Plan:* ${planType}
💳 *Subscription ID:* ${subId}
💵 *Amount:* ${currency} ${amount}
✅ *Status:* Paid
`);
      await sendTelegramMessage(msg);
      console.log(`🔁 Mollie Rebill Success: ${paymentId}`);
    }

    // ⚠️ REBILL FAILED
    if (resource === "payment" && sequenceType === "recurring" && status === "failed") {
      const msg = escapeMarkdownV2(`
🏦 *Source:* Mollie
⚠️ *Subscription Renewal Failed*
📧 *Email:* ${email}
📦 *Plan:* ${planType}
💳 *Subscription ID:* ${subId}
💵 *Amount:* ${currency} ${amount}
❌ *Status:* Failed
`);
      await sendTelegramMessage(msg);
      console.log(`⚠️ Mollie Rebill Failed: ${paymentId}`);
    }

    // 🧾 SUBSCRIPTION CREATED
    if (resource === "subscription" && status === "active") {
      const msg = escapeMarkdownV2(`
🏦 *Source:* Mollie
🧾 *Subscription Created*
📦 *Plan:* ${planType}
💳 *Subscription ID:* ${subId}
👤 *Customer ID:* ${customerId}
✅ *Status:* Active
`);
      await sendTelegramMessage(msg);
      console.log(`🧾 Mollie Subscription Created: ${subId}`);
    }

    // 🚫 SUBSCRIPTION CANCELED
    if (resource === "subscription" && status === "canceled") {
      const msg = escapeMarkdownV2(`
🏦 *Source:* Mollie
🚫 *Subscription Cancelled*
📦 *Plan:* ${planType}
💳 *Subscription ID:* ${subId}
👤 *Customer ID:* ${customerId}
❌ *Status:* Cancelled
`);
      await sendTelegramMessage(msg);
      console.log(`🚫 Mollie Subscription Cancelled: ${subId}`);
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("❌ Mollie webhook error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
