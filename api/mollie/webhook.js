// ✅ /api/mollie/webhook.js — Final Stable Version (with Duplicate Protection + Full Telegram Coverage + Time Stamps)
const processedPayments = new Set();
// Auto-clear cache every 60 s to keep memory clean
setInterval(() => processedPayments.clear(), 60000);

export default async function handler(req, res) {
  try {
    const MOLLIE_KEY = process.env.MOLLIE_SECRET_KEY;
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    const body = req.body;
    const paymentId = body.id || body.paymentId;

    // 🧠 Prevent duplicate processing
    if (processedPayments.has(paymentId)) {
      console.log(`⚠️ Duplicate webhook ignored for ${paymentId}`);
      return res.status(200).send("Duplicate ignored");
    }
    processedPayments.add(paymentId);

    console.log("📬 Mollie webhook received:", paymentId);
    console.log("🔁 Delivery attempt headers:", {
      "X-Mollie-Request-Id": req.headers["x-mollie-request-id"],
      "X-Mollie-Signature": req.headers["x-mollie-signature"],
      "X-Forwarded-For": req.headers["x-forwarded-for"],
    });

    // 🕒 CET timestamp
    const now = new Date();
    const timeCET = now.toLocaleString("en-GB", {
      timeZone: "Europe/Berlin",
      hour12: false,
    });

    // ✅ Fetch full payment details
    const paymentRes = await fetch(`https://api.mollie.com/v2/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MOLLIE_KEY}` },
    });
    const payment = await paymentRes.json();

    if (!payment || !payment.id) {
      console.error("❌ Invalid payment payload:", payment);
      return res.status(400).send("Bad request");
    }

    const email = payment.metadata?.email || payment.customerEmail || "N/A";
    const name = payment.metadata?.name || "Unknown";
    const amount = payment.amount?.value || "0.00";
    const currency = payment.amount?.currency || "EUR";
    const customerId = payment.customerId;
    const sequence = payment.sequenceType;
    const status = payment.status;
    const planType = payment.metadata?.planType || "DID Main Subscription";
    const recurringAmount = payment.metadata?.recurringAmount || "0.00";
    const isRecurring = parseFloat(recurringAmount) > 0;

    // Telegram helper
    async function sendTelegram(text) {
      if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
      try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text,
            parse_mode: "Markdown",
          }),
        });
      } catch (err) {
        console.error("⚠️ Telegram send failed:", err);
      }
    }

    // 💰 1️⃣ Initial payment success
    if (status === "paid" && sequence === "first") {
      await sendTelegram(
        `💰 *INITIAL PAYMENT SUCCESSFUL*\n━━━━━━━━━━━━━━━\n🕒 *Time:* ${timeCET} (CET)\n🏦 *Source:* Mollie\n📧 *Email:* ${email}\n👤 *Name:* ${name}\n📦 *Plan:* ${planType}\n💵 *Initial:* ${currency} ${amount}\n🔁 *Recurring:* ${currency} ${recurringAmount}\n🆔 *Payment ID:* ${payment.id}\n🧾 *Customer ID:* ${customerId}${isRecurring ? "\n⏳ Waiting 8 seconds before creating subscription…" : "\n✅ One-time purchase — no subscription."}`
      );

      // One-time purchases skip subscription creation
      if (!isRecurring) {
        console.log("ℹ️ One-time payment — no recurring subscription needed.");
        return res.status(200).send("OK");
      }

      // Wait 8 s before creating subscription (avoid early-mandate errors)
      await new Promise(r => setTimeout(r, 8000));

      // Create recurring subscription
      const subRes = await fetch(
        `https://api.mollie.com/v2/customers/${customerId}/subscriptions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${MOLLIE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: { value: recurringAmount, currency: "EUR" },
            interval: "1 month",
            description: `${planType} Subscription`,
            metadata: { email, name, planType },
          }),
        }
      );

      const subscription = await subRes.json();
      if (subscription.id) {
        await sendTelegram(
          `🧾 *SUBSCRIPTION STARTED*\n━━━━━━━━━━━━━━━\n🕒 *Time:* ${timeCET} (CET)\n🏦 *Source:* Mollie\n📧 *Email:* ${email}\n👤 *Name:* ${name}\n📦 *Plan:* ${planType}\n💳 *Recurring:* ${currency} ${recurringAmount}\n🧾 *Subscription ID:* ${subscription.id}\n🆔 *Customer ID:* ${customerId}`
        );
      } else {
        console.error("❌ Subscription creation failed:", subscription);
        await sendTelegram(
          `🚫 *SUBSCRIPTION CREATION FAILED*\n━━━━━━━━━━━━━━━\n🕒 *Time:* ${timeCET} (CET)\n📧 *Email:* ${email}\n👤 *Name:* ${name}\n🧾 *Customer ID:* ${customerId}`
        );
      }
    }

    // 🔁 2️⃣ Renewal success
    else if (status === "paid" && sequence === "recurring") {
      await sendTelegram(
        `🔁 *RENEWAL CHARGED*\n━━━━━━━━━━━━━━━\n🕒 *Time:* ${timeCET} (CET)\n📧 *Email:* ${email}\n📦 *Plan:* ${planType}\n💵 *Amount:* ${currency} ${amount}\n🧾 *Customer ID:* ${customerId}`
      );
    }

    // ⚠️ 3️⃣ Renewal failed
    else if (status === "failed" && sequence === "recurring") {
      await sendTelegram(
        `⚠️ *RENEWAL FAILED*\n━━━━━━━━━━━━━━━\n🕒 *Time:* ${timeCET} (CET)\n📧 *Email:* ${email}\n📦 *Plan:* ${planType}\n💵 *Amount:* ${currency} ${amount}\n🧾 *Customer ID:* ${customerId}`
      );
    }

    // ❌ 4️⃣ Initial payment failed
    else if (status === "failed" && sequence !== "recurring") {
      await sendTelegram(
        `❌ *INITIAL PAYMENT FAILED*\n━━━━━━━━━━━━━━━\n🕒 *Time:* ${timeCET} (CET)\n📧 *Email:* ${email}\n📦 *Plan:* ${planType}\n💵 *Amount:* ${currency} ${amount}\n🧾 *Customer ID:* ${customerId}`
      );
    }

    // 🚫 5️⃣ Subscription cancelled
    else if (body.resource === "subscription" && body.status === "canceled") {
      await sendTelegram(
        `🚫 *SUBSCRIPTION CANCELLED*\n━━━━━━━━━━━━━━━\n🕒 *Time:* ${timeCET} (CET)\n📧 *Email:* ${email}\n📦 *Plan:* ${planType}\n🧾 *Customer ID:* ${customerId}`
      );
    }

    // 💤 6️⃣ Fallback
    else {
      console.log(`ℹ️ Payment status: ${status}, sequence: ${sequence}`);
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Mollie Webhook Error:", err);
    res.status(500).send("Internal error");
  }
}
