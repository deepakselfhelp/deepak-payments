// ✅ Mollie Webhook — Deepak Academy Final Version
// Full Telegram reporting + smart retry for mandate confirmation before creating subscription

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = req.body;
    console.log("📬 Mollie webhook received:", body.resource, body.id, body.status);

    const MOLLIE_KEY = process.env.MOLLIE_SECRET_KEY;
    const BASE_URL = process.env.BASE_URL;

    // Escape Markdown for Telegram
    const escapeMarkdownV2 = (t) =>
      t ? t.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1") : "";

    // Telegram sender
    async function sendTelegram(text) {
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

    // Extract core fields safely
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

    // -------------------------------------------------------------------------
    // 💰 1️⃣ PAYMENT SUCCESSFUL (first transaction)
    // -------------------------------------------------------------------------
    if (resource === "payment" && status === "paid" && sequenceType !== "recurring") {
      const msg = escapeMarkdownV2(`
🏦 *Source:* Mollie  
💰 *Initial Payment Successful*  
👤 *Name:* ${name}  
📧 *Email:* ${email}  
📦 *Plan:* ${planType}  
💵 *Amount:* ${currency} ${amount}  
🆔 *Payment ID:* ${paymentId}  
👥 *Customer ID:* ${customerId}  
✅ *Status:* Paid  
`);
      await sendTelegram(msg);
      console.log(`✅ Mollie Payment Success: ${paymentId}`);

      // ---------------------------------------------------------------------
      // Wait for valid mandate — retry up to 30s
      // ---------------------------------------------------------------------
      let validMandate = null;
      for (let i = 0; i < 6; i++) {
        const resMandate = await fetch(
          `https://api.mollie.com/v2/customers/${customerId}/mandates`,
          { headers: { Authorization: `Bearer ${MOLLIE_KEY}` } }
        );
        const data = await resMandate.json();
        validMandate = data._embedded?.mandates?.find((m) => m.status === "valid");
        if (validMandate) break;
        console.log(`⏳ Mandate not ready yet, retry ${i + 1}/6...`);
        await new Promise((r) => setTimeout(r, 5000)); // wait 5s
      }

      // ---------------------------------------------------------------------
      // Create subscription if valid mandate
      // ---------------------------------------------------------------------
      if (validMandate) {
        console.log("✅ Valid mandate found:", validMandate.id);
        const subRes = await fetch(
          `https://api.mollie.com/v2/customers/${customerId}/subscriptions`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${MOLLIE_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              amount: { value: amount, currency: "EUR" },
              interval: "1 month",
              description: `${planType || "Deepak Academy"} Monthly Subscription`,
              metadata: { name, email, planType },
            }),
          }
        );
        const subscription = await subRes.json();
        if (subscription?.id) {
          const subMsg = escapeMarkdownV2(`
🏦 *Source:* Mollie  
🧾 *Subscription Created*  
📦 *Plan:* ${planType}  
👤 *Name:* ${name}  
📧 *Email:* ${email}  
💳 *Subscription ID:* ${subscription.id}  
👥 *Customer ID:* ${customerId}  
✅ *Status:* ${subscription.status}  
`);
          await sendTelegram(subMsg);
          console.log(`🧾 Subscription created: ${subscription.id}`);
        } else {
          const errMsg = escapeMarkdownV2(`
⚠️ *Subscription creation failed after valid mandate*  
👤 *Name:* ${name}  
📧 *Email:* ${email}  
💳 *Customer ID:* ${customerId}  
❌ Error: ${JSON.stringify(subscription)}`);
          await sendTelegram(errMsg);
          console.error("❌ Subscription creation failed:", subscription);
        }
      } else {
        const noMandateMsg = escapeMarkdownV2(`
⚠️ *Mandate not confirmed after 30s — subscription skipped*  
📧 *Email:* ${email}  
👤 *Name:* ${name}  
📦 *Plan:* ${planType}  
💵 *Amount:* ${currency} ${amount}  
🆔 *Payment ID:* ${paymentId}  
👥 *Customer ID:* ${customerId}  
`);
        await sendTelegram(noMandateMsg);
        console.log("⚠️ No valid mandate after 30s — skipped subscription creation.");
      }
    }

    // -------------------------------------------------------------------------
    // ⚠️ 2️⃣ PAYMENT FAILED
    // -------------------------------------------------------------------------
    if (resource === "payment" && status === "failed") {
      const msg = escapeMarkdownV2(`
🏦 *Source:* Mollie  
❌ *Payment Failed*  
👤 *Name:* ${name}  
📧 *Email:* ${email}  
📦 *Plan:* ${planType}  
💵 *Amount:* ${currency} ${amount}  
🆔 *Payment ID:* ${paymentId}  
`);
      await sendTelegram(msg);
      console.log(`❌ Mollie Payment Failed: ${paymentId}`);
    }

    // -------------------------------------------------------------------------
    // 🔁 3️⃣ SUBSCRIPTION REBILL SUCCESS
    // -------------------------------------------------------------------------
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
      await sendTelegram(msg);
      console.log(`🔁 Mollie Rebill Success: ${paymentId}`);
    }

    // -------------------------------------------------------------------------
    // 🚫 4️⃣ SUBSCRIPTION REBILL FAILED
    // -------------------------------------------------------------------------
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
      await sendTelegram(msg);
      console.log(`⚠️ Mollie Rebill Failed: ${paymentId}`);
    }

    // -------------------------------------------------------------------------
    // 🧾 5️⃣ SUBSCRIPTION ACTIVATED / CREATED (direct event)
    // -------------------------------------------------------------------------
    if (resource === "subscription" && status === "active") {
      const msg = escapeMarkdownV2(`
🏦 *Source:* Mollie  
🧾 *Subscription Activated*  
📦 *Plan:* ${planType}  
📧 *Email:* ${email}  
👤 *Name:* ${name}  
💳 *Subscription ID:* ${subId}  
👥 *Customer ID:* ${customerId}  
✅ *Status:* Active  
`);
      await sendTelegram(msg);
      console.log(`🧾 Mollie Subscription Activated: ${subId}`);
    }

    // -------------------------------------------------------------------------
    // ❌ 6️⃣ SUBSCRIPTION CANCELLED
    // -------------------------------------------------------------------------
    if (resource === "subscription" && status === "canceled") {
      const msg = escapeMarkdownV2(`
🏦 *Source:* Mollie  
🚫 *Subscription Cancelled*  
📦 *Plan:* ${planType}  
📧 *Email:* ${email}  
💳 *Subscription ID:* ${subId}  
👥 *Customer ID:* ${customerId}  
❌ *Status:* Cancelled  
`);
      await sendTelegram(msg);
      console.log(`🚫 Mollie Subscription Cancelled: ${subId}`);
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("❌ Mollie webhook error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
