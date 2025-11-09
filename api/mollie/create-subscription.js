// ✅ Deepak Academy — Create Subscription (called automatically by webhook.js)
// Works after successful initial payment and mandate confirmation

export default async function handler(req, res) {
  try {
    const MOLLIE_KEY = process.env.MOLLIE_SECRET_KEY;
    const { customerId, amount, planType, email, name } = req.body;

    // --- Basic validation ---
    if (!customerId || !amount) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    console.log(`📦 Creating subscription for ${email || "Unknown"} (${customerId})`);

    // --- Step 1: Create the subscription ---
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
          metadata: { email, name, planType, createdBy: "webhook_auto" },
          webhookUrl: "https://checkout.realcoachdeepak.com/api/mollie/webhook",
        }),
      }
    );

    const subscription = await subRes.json();

    // --- Step 2: Validate Mollie response ---
    if (!subscription?.id) {
      console.error("❌ Subscription creation failed:", subscription);
      return res.status(400).json({
        error: "Subscription creation failed",
        details: subscription,
      });
    }

    console.log(`✅ Subscription Created: ${subscription.id} for ${email}`);
    res.status(200).json(subscription);

  } catch (err) {
    console.error("❌ create-subscription.js error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

