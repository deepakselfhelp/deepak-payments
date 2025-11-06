// ✅ /api/razorpay/webhook.js
// Razorpay webhook → Telegram notification (MarkdownV2 safe)

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const body = req.body;
    const event = body.event;
    const payment = body.payload?.payment?.entity;

    console.log("Received webhook event:", event);

    // 🧠 Helper to escape MarkdownV2 special characters
    function escapeMarkdownV2(text) {
      return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
    }

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

      // ✅ Escape message for MarkdownV2 safety
      const message = escapeMarkdownV2(`
💰 *New Payment Captured*
📦 *Product:* ${product}
📧 *Email:* ${email}
📱 *Phone:* ${contact}
💵 *Amount:* ${currency} ${amount}
🆔 *Payment ID:* ${payment.id}
`);

      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;

      if (botToken && chatId) {
        try {
          const tgResponse = await fetch(
            `https://api.telegram.org/bot${botToken}/sendMessage`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: "MarkdownV2",
              }),
            }
          );

          const tgResult = await tgResponse.json();
          console.log("🔎 Telegram API result:", tgResult);
        } catch (err) {
          console.error("❌ Telegram send error:", err);
        }
      } else {
        console.warn("⚠️ Telegram credentials missing in environment variables.");
      }

      console.log("✅ Payment captured and Telegram message attempted.");
    }

    res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error("❌ Error processing webhook:", err);
    res.status(500).json({ status: "error", error: err.message });
  }
}
