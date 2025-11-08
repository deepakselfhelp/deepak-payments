export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const body = req.body;
    console.log("📬 Mollie webhook received:", body.id, body.status);

    function escapeMarkdown(text) {
      return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
    }

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

    const email = body.metadata?.email || "N/A";
    const name = body.metadata?.name || "N/A";
    const amount = body.amount?.value || "0.00";
    const currency = body.amount?.currency || "EUR";
    const paymentId = body.id || "unknown";
    const status = body.status || "unknown";
    const product = body.description || "Deepak Academy Product";
    const subId = body.subscriptionId || "N/A";
    const sequence = body.sequenceType || "oneoff";

    if (status === "paid" && sequence === "oneoff") {
      const msg = escapeMarkdown(`
🏦 *Source:* Mollie
💰 *New Payment Successful*
📦 *Product:* ${product}
📧 *Email:* ${email}
💵 *Amount:* ${currency} ${amount}
🆔 *Payment ID:* ${paymentId}
      `);
      await sendTelegramMessage(msg);
      console.log(`✅ Payment received: ${paymentId}`);
    }

    if (status === "paid" && sequence === "recurring") {
      const msg = escapeMarkdown(`
🏦 *Source:* Mollie
🔁 *Subscription Renewal Charged*
📦 *Product:* ${product}
📧 *Email:* ${email}
💵 *Amount:* ${currency} ${amount}
🧾 *Subscription ID:* ${subId}
🆔 *Payment ID:* ${paymentId}
      `);
      await sendTelegramMessage(msg);
      console.log(`🔁 Renewal charged: ${paymentId}`);
    }

    if (status === "failed" || status === "expired" || status === "canceled") {
      const reason = body.failureReason || "Unknown";
      const msg = escapeMarkdown(`
🏦 *Source:* Mollie
⚠️ *Payment Failed*
📧 *Email:* ${email}
💵 *Amount:* ${currency} ${amount}
❌ *Reason:* ${reason}
🆔 *Payment ID:* ${paymentId}
      `);
      await sendTelegramMessage(msg);
      console.log(`⚠️ Payment failed: ${paymentId}`);
    }

    if (body.resource === "subscription" && body.status === "canceled") {
      const msg = escapeMarkdown(`
🏦 *Source:* Mollie
🚫 *Subscription Cancelled*
📧 *Email:* ${email}
🧾 *Subscription ID:* ${subId}
💬 *Reason:* ${body.reason || "Cancelled manually or failed rebill"}
      `);
      await sendTelegramMessage(msg);
      console.log(`🚫 Subscription cancelled: ${subId}`);
    }

    res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error("❌ Mollie Webhook Error:", err);
    res.status(500).json({ error: err.message });
  }
}
