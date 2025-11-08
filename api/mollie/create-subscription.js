// ✅ /api/mollie/create-subscription.js
export default async function handler(req, res) {
  try {
    const MOLLIE_KEY = process.env.MOLLIE_SECRET_KEY;
    const { customerId, amount, planType } = req.body;

    if (!customerId || !amount) {
      return res.status(400).json({ error: "Missing required fields" });
    }

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
          metadata: { source: "auto-created after initial payment" },
        }),
      }
    );

    const subscription = await subRes.json();

    if (!subscription?.id) {
      console.error("❌ Subscription creation failed:", subscription);
      return res.status(400).json({ error: "Subscription creation failed" });
    }

    console.log("✅ Subscription created:", subscription.id);
    res.status(200).json(subscription);

  } catch (err) {
    console.error("❌ create-subscription.js error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
