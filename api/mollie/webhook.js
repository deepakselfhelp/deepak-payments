// ✅ Mollie Webhook — Sends all payment + subscription events to Telegram

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const body = req.body;

    // 🧾 Mollie sends payment and subscription updates in the same webhook
    console.log("📬 Received Mollie Webhook Event:", body);

    // 🧠 Markdown escape for Telegram
    function escapeMarkdownV2(text) {
      return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
    }

    // 🔔 Telegram sender
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

    // 🧩 Extract details safely
    const payment = body;
    const status = payment.status;
    const email = payment.metadata?.email || "N/A";
    const name = payment.metadata?.name || "N/A";
    const product = payment.metadata?.product || "Mollie Subscription";
    const amount = payment.amount?.value || "N/A";
    const currency = payment.amount?.currency || "EUR";
    const paymentId = payment.id || "N/A";

    // 💰 1️⃣ Payment succeeded
    if (status === "paid") {
      const message = escapeMarkdownV2(`
🏦 *Source:* Mollie
💰 *Payment Successful*
📦 *Product:* ${product}
👤 *Name:* ${name}
📧 *Email:* ${email}
💵 *Amount:* ${currency} ${amount}
🆔 *Payment ID:* ${paymentId}
`);
      await sendTelegramMessage(message);
      console.log(`✅ [Mollie Payment Paid] ${paymentId}`);
    }

    // ⚠️ 2️⃣ Payment failed
    if (status === "failed") {
      const message = escapeMarkdownV2(`
🏦 *Source:* Mollie
⚠️ *Payment Failed*
📦 *Product:* ${product}
👤 *Name:* ${name}
📧 *Email:* ${email}
💵 *Amount:* ${currency} ${amount}
🆔 *Payment ID:* ${paymentId}
`);
      await sendTelegramMessage(message);
      console.log(`⚠️ [Mollie Payment Failed] ${paymentId}`);
    }

    // 🕓 3️⃣ Payment pending (for SEPA/bank)
    if (status === "open" || status === "pending") {
      const message = escapeMarkdownV2(`
🏦 *Source:* Mollie
⏳ *Payment Pending*
📦 *Product:* ${product}
👤 *Name:* ${name}
📧 *Email:* ${email}
💵 *Amount:* ${currency} ${amount}
🆔 *Payment ID:* ${paymentId}
`);
      await sendTelegramMessage(message);
      console.log(`⏳ [Mollie Payment Pending] ${paymentId}`);
    }

    // 🚫 4️⃣ Subscription cancelled (if Mollie sends subscription event)
    if (body.resource === "subscription" && body.status === "canceled") {
      const subId = body.id || "N/A";
      const message = escapeMarkdownV2(`
🏦 *Source:* Mollie
🚫 *Subscription Cancelled*
📦 *Product:* ${product}
👤 *Name:* ${name}
📧 *Email:* ${email}
🧾 *Subscription ID:* ${subId}
`);
      await sendTelegramMessage(message);
      console.log(`🚫 [Mollie Subscription Cancelled] ${subId}`);
    }

    res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error("❌ [Mollie Webhook Error]:", err);
    res.status(500).json({ status: "error", error: err.message });
  }
}
