export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const MOLLIE_KEY = process.env.MOLLIE_SECRET_KEY;
    const { id } = req.body; // Mollie webhook only sends the payment or subscription ID

    console.log("📬 Mollie webhook received:", id);

    if (!id) {
      console.warn("⚠️ No ID received in Mollie webhook payload");
      return res.status(400).json({ error: "Missing ID in Mollie webhook" });
    }

    // ✅ Fetch full payment/subscription details from Mollie
    const paymentRes = await fetch(`https://api.mollie.com/v2/payments/${id}`, {
      headers: { Authorization: `Bearer ${MOLLIE_KEY}` },
    });
    const payment = await paymentRes.json();

    console.log("✅ Full Mollie payment object:", JSON.stringify(payment, null, 2));

    // Helper: escape Markdown special characters for Telegram
    function escapeMarkdownV2(text) {
      return text ? text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1") : "";
    }

    // ✅ Telegram message sender
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

    // Extract details
    const email = payment.metadata?.email || "N/A";
    const name = payment.metadata?.name || "N/A";
    const amount = payment.amount?.value || "0.00";
    const currency = payment.amount?.currency || "EUR";
    const status = payment.status || "unknown";
    const product = payment.description || "Deepak Academy Product";
    const paymentId = payment.id || "N/A";
    const sequence = payment.sequenceType || "oneoff";
    const subscriptionId = payment.subscriptionId || "N/A";

    // ✅ Handle Successful First Payment
    if (status === "paid" && sequence === "first") {
      const msg = escapeMarkdownV2(`
🏦 *Source:* Mollie
💰 *New Subscription Started*
📦 *Product:* ${product}
📧 *Email:* ${email}
💵 *Amount:* ${currency} ${amount}
🆔 *Payment ID:* ${paymentId}
🧾 *Subscription ID:* ${subscriptionId}
`);
      await sendTelegramMessage(msg);
      console.log(`✅ [New Subscription Started] ${paymentId}`);
    }

    // ✅ Handle Subscription Renewals
    if (status === "paid" && sequence === "recurring") {
      const msg = escapeMarkdownV2(`
🏦 *Source:* Mollie
🔁 *Subscription Renewal Charged*
📦 *Product:* ${product}
📧 *Email:* ${email}
💵 *Amount:* ${currency} ${amount}
🧾 *Subscription ID:* ${subscriptionId}
🆔 *Payment ID:* ${paymentId}
`);
      await sendTelegramMessage(msg);
      console.log(`🔁 [Renewal Charged] ${paymentId}`);
    }

    // ⚠️ Handle Payment Failures
    if (status === "failed" || status === "expired" || status === "canceled") {
      const failReason = payment.failureReason || "Unknown reason";
      const msg = escapeMarkdownV2(`
🏦 *Source:* Mollie
⚠️ *Payment Failed*
📧 *Email:* ${email}
💵 *Amount:* ${currency} ${amount}
❌ *Reason:* ${failReason}
🆔 *Payment ID:* ${paymentId}
`);
      await sendTelegramMessage(msg);
      console.log(`⚠️ [Payment Failed] ${paymentId}`);
    }

    // 🚫 Handle Subscription Cancellations (Mandate revoked)
    if (payment.status === "canceled" || payment.sequenceType === "recurring_cancelled") {
      const msg = escapeMarkdownV2(`
🏦 *Source:* Mollie
🚫 *Subscription Cancelled*
📧 *Email:* ${email}
🧾 *Subscription ID:* ${subscriptionId}
❌ *Reason:* Cancelled manually or by customer
`);
      await sendTelegramMessage(msg);
      console.log(`🚫 [Subscription Cancelled] ${subscriptionId}`);
    }

    res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error("❌ [Mollie Webhook Error]:", err);
    res.status(500).json({ error: err.message });
  }
}
