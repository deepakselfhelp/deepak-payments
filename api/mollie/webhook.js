// ✅ /api/mollie/webhook.js — Stable Version with 8s Delay for Subscription + Full Telegram Coverage
export default async function handler(req, res) {
  try {
    const MOLLIE_KEY = process.env.MOLLIE_SECRET_KEY;
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    const body = req.body;
    const paymentId = body.id || body.paymentId;

    console.log("📬 Mollie webhook received:", paymentId);
    console.log("🔁 Delivery attempt headers:", {
      "X-Mollie-Request-Id": req.headers["x-mollie-request-id"],
      "X-Mollie-Signature": req.headers["x-mollie-signature"],
      "X-Forwarded-For": req.headers["x-forwarded-for"],
    });

    // 🕒 CET time
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

    // 🔔 Telegram helper
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

    // 💰 1️⃣ Initial Payment Success
    if (status === "paid" && sequence === "first") {
      const startTime = Date.now();

      await sendTelegram(
        `💰 *INITIAL PAYMENT SUCCESSFUL*\n━━━━━━━━━━━━━━━\n🕒 *Time:* ${timeCET} (CET)\n🏦 *Source:* Mollie\n📧 *Email:* ${email}\n👤 *Name:* ${name}\n📦 *Plan:* ${planType}\n💵 *Amount:* ${currency} ${amount}\n🆔 *Payment ID:* ${payment.id}\n🧾 *Customer ID:* ${customerId}\n⏳ Waiting 8 seconds before creating subscription...`
      );

      // 🕗 Delay 8s to allow Mollie mandate creation
      await new Promise(resolve => setTimeout(resolve, 8000));

      // 🔄 Auto-create subscription
      const subRes = await fetch(
        `https://api.mollie.com/v2/customers/${customerId}/subscriptions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${MOLLIE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: { value: "29.00", currency: "EUR" },
            interval: "1 month",
            description: planType,
            metadata: { email, name },
          }),
        }
      );

      const subscription = await subRes.json();
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      if (subscription.id) {
        console.log(`✅ Subscription created in ${duration}s: ${subscription.id}`);
        await sendTelegram(
          `🧾 *SUBSCRIPTION STARTED*\n━━━━━━━━━━━━━━━\n🕒 *Time:* ${timeCET} (CET)\n🏦 *Source:* Mollie\n📧 *Email:* ${email}\n👤 *Name:* ${name}\n📦 *Plan:* ${planType}\n💳 *Amount:* ${currency} ${amount}\n🧾 *Subscription ID:* ${subscription.id}\n🆔 *Customer ID:* ${customerId}\n⏱ *Execution:* ${duration}s`
        );
      } else {
        console.error("❌ Subscription creation failed:", subscription);
        await sendTelegram(
          `🚫 *SUBSCRIPTION CREATION FAILED*\n━━━━━━━━━━━━━━━\n🕒 *Time:* ${timeCET} (CET)\n📧 *Email:* ${email}\n👤 *Name:* ${name}\n🧾 *Customer ID:* ${customerId}`
        );
      }
    }

    // 🔁 2️⃣ Renewal Success
    else if (status === "paid" && sequence === "recurring") {
      await sendTelegram(
        `🔁 *RENEWAL CHARGED*\n━━━━━━━━━━━━━━━\n🕒 *Time:* ${timeCET} (CET)\n📧 *Email:* ${email}\n📦 *Plan:* ${planType}\n💵 *Amount:* ${currency} ${amount}\n🧾 *Customer ID:* ${customerId}`
      );
    }

    // ⚠️ 3️⃣ Renewal Failed
    else if (status === "failed" && sequence === "recurring") {
      await sendTelegram(
        `⚠️ *RENEWAL FAILED*\n━━━━━━━━━━━━━━━\n🕒 *Time:* ${timeCET} (CET)\n📧 *Email:* ${email}\n📦 *Plan:* ${planType}\n💵 *Amount:* ${currency} ${amount}\n🧾 *Customer ID:* ${customerId}`
      );
    }

    // ❌ 4️⃣ Initial Payment Failed
    else if (status === "failed" && sequence !== "recurring") {
      await sendTelegram(
        `❌ *INITIAL PAYMENT FAILED*\n━━━━━━━━━━━━━━━\n🕒 *Time:* ${timeCET} (CET)\n📧 *Email:* ${email}\n📦 *Plan:* ${planType}\n💵 *Amount:* ${currency} ${amount}\n🧾 *Customer ID:* ${customerId}`
      );
    }

    // 🚫 5️⃣ Subscription Cancelled
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


