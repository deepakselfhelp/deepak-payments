// ✅ Deepak Academy — Mollie Webhook (Production Safe Version)
// Sends Telegram updates and auto-creates subscription after payment success.

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = req.body;
    console.log("📬 Mollie webhook received:", body.resource, body.id, body.status);

    // --- Helpers ---
    const escapeMarkdownV2 = (text = "") =>
      text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");

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

    // --- Extract common info ---
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

    // 💰 1️⃣ PAYMENT SUCCESS (initial)
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

      // 🕒 Wait 8 seconds before subscription
      console.log("⏳ Waiting 8 seconds for mandate to finalize...");
      await new Promise(r => setTimeout(r, 8000));

      // 🔁 Try creating subscription (with one retry)
      async function createSubscription(retry = false) {
        try {
          const resp = await fetch(`${process.env.BASE_URL}/api/mollie/create-subscription`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ customerId, amount, planType, email, name }),
          });

          if (!resp.ok) {
            if (!retry) {
              console.log("⚠️ Subscription creation failed, retrying in 20s...");
              await new Promise(r => setTimeout(r, 20000));
              return await createSubscription(true);
            } else {
              console.log("❌ Subscription failed even after retry.");
              await sendTelegramMessage(
                escapeMarkdownV2(`🚨 *Subscription Creation Failed After Retry*\n📧 ${email}\n💵 ${currency} ${amount}\n👤 ${customerId}`)
              );
            }
            return;
          }

          const sub = await resp.json();
          console.log("📦 Subscription Created:", sub.id || sub);
          await sendTelegramMessage(
            escapeMarkdownV2(`🧾 *Subscription Created Successfully*\n📦 ${planType}\n💳 Subscription ID: ${sub.id}\n📧 ${email}\n👤 ${customerId}`)
          );
        } catch (err) {
          console.error("Subscription creation error:", err);
        }
      }

      await createSubscription();
    }

    // ⚠️ 2️⃣ PAYMENT FAILED
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
    }

    // 🔁 3️⃣ REBILL SUCCESS
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
    }

    // ⚠️ 4️⃣ REBILL FAILED
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
    }

    // 🧾 5️⃣ SUBSCRIPTION CREATED (direct webhook from Mollie)
    if (resource === "subscription" && status === "active") {
      const msg = escapeMarkdownV2(`
🏦 *Source:* Mollie
🧾 *Subscription Activated*
📦 *Plan:* ${planType}
💳 *Subscription ID:* ${subId}
📧 *Email:* ${email}
👤 *Customer ID:* ${customerId}
✅ *Status:* Active
`);
      await sendTelegramMessage(msg);
    }

    // 🚫 6️⃣ SUBSCRIPTION CANCELED
    if (resource === "subscription" && status === "canceled") {
      const msg = escapeMarkdownV2(`
🏦 *Source:* Mollie
🚫 *Subscription Cancelled*
📦 *Plan:* ${planType}
💳 *Subscription ID:* ${subId}
📧 *Email:* ${email}
👤 *Customer ID:* ${customerId}
❌ *Status:* Cancelled
`);
      await sendTelegramMessage(msg);
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("❌ Mollie webhook error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
