// ✅ /api/razorpay/webhook.js
// Handles Razorpay payment webhooks and sends Telegram notifications

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const body = req.body;

    // 🔍 Extract the event type
    const event = body.event;
    const payment = body.payload?.payment?.entity;

    console.log("Received webhook event:", event);

    // ✅ Process successful payments only
    if (event === "payment.captured" && payment) {
      const amount = (payment.amount / 100).toFixed(2);
      const currency = payment.currency || "INR";
      const email = payment.email || payment.contact || "N/A";
      const contact = payment.contact || "N/A";
      const notes = payment.notes || {};

      // 🔹 Try to extract product info from notes or fallback
      const product =
        notes.product ||
        notes.plan_name ||
        notes.subscription_name ||
        "Subscription (via Razorpay Button)";

      // 🧾 Build Telegram message
      const message = `
💰 *New Payment Captured*
📦 *Product:* ${product}
📧 *Email:* ${email}
📱 *Phone:* ${contact}
💵 *Amount:* ${currency} ${amount}
🆔 *Payment ID:* ${payment.id}
`;

      // 📨 Send Telegram notification
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;

      if (botToken && chatId) {
        await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: message,
              parse_mode: "Markdown",
            }),
          }
        );
      } else {
        console.warn("⚠️ Telegram credentials missing in environment variables.");
      }

      console.log("✅ Payment captured and Telegram message sent.");
    }

    // Respond OK to Razorpay
    res.status(200).json({ status: "success" });
  } catch (err) {
    console.error("❌ Error processing webhook:", err);
    res.status(500).json({ status: "error", error: err.message });
  }
}
