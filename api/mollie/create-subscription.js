// ✅ /api/create-subscription.js
export default async function handler(req, res) {
  try {
    const MOLLIE_KEY = process.env.MOLLIE_SECRET_KEY;
    const { customerId, amount } = req.body;

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
          description: `Deepak Monthly Membership ${amount}€`,
          metadata: { source: "initialPaymentWebhook" },
        }),
      }
    );

    const subscription = await subRes.json();
    console.log("✅ Subscription created:", subscription.id);
    res.status(200).json(subscription);
  } catch (err) {
    console.error("Create subscription error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
