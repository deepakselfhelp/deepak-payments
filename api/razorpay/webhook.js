// ✅ /api/razorpay/webhook.js
// Razorpay webhook with detailed logging and Telegram alerts (MarkdownV2 safe)

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const body = req.body;
    const event = body.event;
    const payment = body.payload?.payment?.entity;
    const subscription = body.payload?.subscription?.entity;

    console.log(`📬 Received Razorpay Event: ${event}`);

    // 🧠 Helper to escape MarkdownV2 special characters
    function escapeMarkdownV2(text) {
      return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
    }

    // 🧩 Helper to send Telegram messages
    async function sendTelegramMessage(text) {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (!botToken || !chatId) {
        console.warn("⚠️ Telegram credentials missing.");
        return;
      }

      try {
        const resp = await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text,
              parse_mode: "MarkdownV2",
            }),
          }
        );
        const data = await resp.json();
        console.log("🔎 Telegram API result:", data);
      } catch (err) {
        console.error("❌ Telegram send error:", err);
      }
    }

    // 💳 Initial payment (first capture)
    if (event === "payment.captured" && payment) {
      const amount = (payment.amount / 100).toFixed(2);
      const currency = payment.currency || "INR";
      const email = payment.email || payment.contact || "N/A";
      const contact = payment.contact || "N/A";
      const notes = payment.notes || {};
      const product =
        notes.product ||
        notes.plan_name ||
        notes.subscription_name ||
        "Subscription (via Razorpay Button)";

      const message = escapeMarkdownV2(`
💰 *New Payment Captured*
📦 *Product:* ${product}
📧 *Email:* ${email}
📱 *Phone:* ${contact}
💵 *Amount:* ${currency} ${amount}
🆔 *Payment ID:* ${payment.id}
`);

      await sendTelegramMessage(message);
      console.log(`✅ [Payment Captured] ${payment.id} — ${currency} ${amount}`);
    }

    // 🔁 Subscription renewals
    if (event === "subscription.charged" && subscription) {
      const planName =
        subscription.notes?.product || subscription.plan_id || "Razorpay Plan";
      const totalCount = subscription.total_count || "∞";
      const subId = subscription.id;
      const message = escapeMarkdownV2(`
🔁 *Subscription Renewal Charged*
📦 *Product:* ${planName}
🧾 *Subscription ID:* ${subId}
💳 *Cycle Count:* ${totalCount}
`);

      await sendTelegramMessage(message);
      console.log(`🔁 [Renewal] Subscription ${subId} charged successfully.`);
    }

    // ⚠️ Failed payments
    if (event === "payment.failed" && payment) {
      const amount = (payment.amount / 100).toFixed(2);
      const currency = payment.currency || "INR";
      const failReason = payment.error_description || "Unknown reason";
      const message = escapeMarkdownV2(`
⚠️ *Payment Failed!*
💵 *Amount:* ${currency} ${amount}
📧 *Email:* ${payment.email || "N/A"}
📱 *Phone:* ${payment.contact || "N/A"}
❌ *Reason:* ${failReason}
🆔 *Payment ID:* ${payment.id}
`);

      await sendTelegramMessage(message);
      console.log(`⚠️ [Payment Failed] ${payment.id} — ${failReason}`);
    }

    // ✅ Always respond OK
    res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error("❌ [Webhook Error]:", err);
    res.status(500).json({ status: "error", error: err.message });
  }
}
