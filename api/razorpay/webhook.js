const TELEGRAM_BOT_TOKEN = "7417011644:AAHJxdrNGkoydxL1pB1XvFFp3DULKMLYph4";
const TELEGRAM_CHAT_ID = "619386951";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  console.log("Received webhook event:", req.body.event);

  try {
    const payment = req.body.payload?.payment?.entity || {};
    const amount = (payment.amount / 100).toFixed(2);
    const email = payment.email || "N/A";
    const status = payment.status || "unknown";

    const message = `💰 Razorpay *${status.toUpperCase()}*\n📧 ${email}\n💳 ₹${amount}`;

    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "Markdown",
      }),
    });

    console.log("Telegram message sent");
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: error.message });
  }
}
