// ✅ Deepak Razorpay Webhook — All major events + Telegram alerts + clean logs

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

    // 🧠 Escape MarkdownV2 special characters for Telegram
    function escapeMarkdownV2(text) {
      return text.replace(/([_*\[\]()~`>#+\\-=|{}.!])/g, '\\$1');
    }

    // 🧩 Telegram message sender
    async function sendTelegramMessage(text) {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (!botToken || !chatId) {
        console.warn("⚠️ Telegram credentials missing.");
        return;
      }

      try {
        const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: "MarkdownV2",
          }),
        });
        const data = await resp.json();
        console.log("🔎 Telegram API result:", data);
      } catch (err) {
        console.error("❌ Telegram send error:", err);
      }
    }

    // 💳 1️⃣ Payment Captured (initial charge)
    if (event === "payment.captured" && payment) {
      const amount = (payment.amount / 100).toFixed(2);
      const currency = payment.currency || "INR";
      const email = payment.email || "N/A";
      const contact = payment.contact || "N/A";
      const notes = payment.notes || {};
      const product =
        notes.product || notes.plan_name || notes.subscription_name || "Subscription (via Razorpay Button)";

      const message = escapeMarkdownV2(`
🏦 *Source:* Razorpay
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

    // 🔁 2️⃣ Subscription Renewal Charged
    if (event === "subscription.charged" && subscription) {
      const planName =
        subscription.notes?.product ||
        (subscription.plan_id === "plan_RcO3xG88LCkMNo"
          ? "HindiPro Subscription (₹699/month)"
          : subscription.plan_id) ||
        "Razorpay Plan";
      const subId = subscription.id;
      const totalCount = subscription.total_count || "∞";

      const message = escapeMarkdownV2(`
🏦 *Source:* Razorpay
🔁 *Subscription Renewal Charged*
📦 *Product:* ${planName}
🧾 *Subscription ID:* ${subId}
💳 *Cycle Count:* ${totalCount}
`);

      await sendTelegramMessage(message);
      console.log(`🔁 [Renewal] Subscription ${subId} charged successfully.`);
    }

    // ⚠️ 3️⃣ Payment Failed (initial or rebill)
    if (event === "payment.failed" && payment) {
      const amount = (payment.amount / 100).toFixed(2);
      const currency = payment.currency || "INR";
      const failReason = payment.error_description || "Unknown reason";

      const message = escapeMarkdownV2(`
🏦 *Source:* Razorpay
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

    // 🚫 / 🚨 4️⃣ Subscription Cancelled or Failed After Multiple Attempts
    if (event === "subscription.cancelled" && subscription) {
      const planName =
        subscription.notes?.product ||
        (subscription.plan_id === "plan_RcO3xG88LCkMNo"
          ? "HindiPro Subscription (₹699/month)"
          : subscription.plan_id) ||
        "Razorpay Plan";
      const subId = subscription.id;
      const reason = subscription.cancel_reason || "Cancelled manually or after failed rebills";
      const failedRebill =
        reason.includes("multiple failed rebill") || reason.includes("failed payment");

      // 🧩 Try to pull email from customer details if available
      const email = subscription.customer_notify_email || subscription.customer_email || "N/A";

      const message = escapeMarkdownV2(`
🏦 *Source:* Razorpay
${failedRebill ? "🚨 *Subscription Failed After Multiple Rebill Attempts!*" : "🚫 *Subscription Cancelled*"}
📦 *Product:* ${planName}
📧 *Email:* ${email}
🧾 *Subscription ID:* ${subId}
❌ *Reason:* ${reason}
`);

      await sendTelegramMessage(message);
      console.log(
        failedRebill
          ? `🚨 [Final Failure] Subscription ${subId} — ${reason}`
          : `🚫 [Cancelled] Subscription ${subId} — ${reason}`
      );
    }

    // ⏳ Ensure logs flush
    await new Promise((r) => setTimeout(r, 500));
    res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error("❌ [Webhook Error]:", err);
    res.status(500).json({ status: "error", error: err.message });
  }
}
