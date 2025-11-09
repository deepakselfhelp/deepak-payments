// ✅ Deepak Academy — Mollie Create Subscription (Final Version)
// Called automatically from webhook.js after valid mandate confirmation

export default async function handler(req, res) {
  try {
    const MOLLIE_KEY = process.env.MOLLIE_SECRET_KEY;
    const { customerId, amount, planType, name, email } = req.body;

    // 🔒 Validate required fields
    if (!customerId || !amount) {
      console.error("❌ Missing required fields:", { customerId, amount });
      return res.status(400).json({ error: "Missing customerId or amount" });
    }

    // -------------------------------------------------------------------
    // 1️⃣ Create Subscription (recurring every 1 month)
    // -------------------------------------------------------------------
    console.log(`🧾 Creating Mollie subscription for customer: ${customerId}`);

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
          startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0], // starts next month
          webhookUrl: "https://checkout.realcoachdeepak.com/api/mollie/webhook",
          metadata: {
            name: name || "N/A",
            email: email || "N/A",
            planType,
            type: "subscription",
          },
        }),
      }
    );

    const subscription = await subRes.json();

    // -------------------------------------------------------------------
    // 2️⃣ Validate and Respond
    // -------------------------------------------------------------------
    if (subRes.status !== 201 || !subscription?.id) {
      console.error("❌ Subscription creation failed:", subscription);
      return res.status(400).json({
        error: "Subscription creation failed",
        details: subscription,
      });
    }

    console.log(`✅ Subscription Created: ${subscription.id}`);
    res.status(200).json(subscription);
  } catch (err) {
    console.error("❌ create-subscription.js error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
