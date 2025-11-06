// /api/razorpay/webhook.js

import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const secret = process.env.RAZORPAY_KEY_SECRET;

    // Validate signature
    const shasum = crypto.createHmac("sha256", secret);
    shasum.update(JSON.stringify(req.body));
    const digest = shasum.digest("hex");

    const signature = req.headers["x-razorpay-signature"];
    if (digest !== signature) {
      console.error("Invalid signature from Razorpay");
      return res.status(400).json({ error: "Invalid signature" });
    }

    const event = req.body.event;
    const payload = req.body.payload;

    console.log("✅ Webhook event:", event);

    // Example: extract relevant info
    let message = "";
    if (event === "payment.captured") {
      message = `💰 Razorpay Payment Captured\n🧍‍♂️ Customer: ${
        payload.payment.entity.email || "N/A"
      }\n💳 Amount: ₹${payload.payment.entity.amount / 100}\n🔖 Status: ${
        payload.payment.entity.status
      }`;
    } else if (event === "payment.failed") {
      message = `⚠️ Razorpay Payment Failed\nEmail: ${
        payload.payment.entity.email || "N/A"
      }\nReason: ${payload.payment.entity.error_description || "Unknown"}`;
    } else if (event.startsWith("subscription.")) {
      message = `🔁 Razorpay Subscription Event: ${event}`;
    } else {
      message = `ℹ️ Unhandled Razorpay event: ${event}`;
    }

    // Send to Telegram
    const telegramUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: message,
      }),
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
