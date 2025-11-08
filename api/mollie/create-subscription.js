// ✅ File: /api/mollie/create-subscription.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const MOLLIE_KEY = process.env.MOLLIE_SECRET_KEY;
    const { name, email } = req.body;

    if (!email || !name) {
      return res.status(400).json({ error: "Name and email are required" });
    }

    // 🧾 1️⃣ Create a Mollie customer
    const custRes = await fetch("https://api.mollie.com/v2/customers", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MOLLIE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, email }),
    });

    const customer = await custRes.json();
    if (!customer.id) {
      console.error("Customer creation failed:", customer);
      return res.status(400).json({ error: "Failed to create Mollie customer" });
    }

    // 💳 2️⃣ Create the initial recurring payment (subscription)
    const subRes = await fetch("https://api.mollie.com/v2/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MOLLIE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: { value: "29.00", currency: "EUR" },
        description: "Deepak Academy Main Subscription (€29/month)",
        sequenceType: "first", // first payment of a recurring series
        customerId: customer.id,
        redirectUrl: "https://checkout.realcoachdeepak.com/success.html",
        webhookUrl: "https://checkout.realcoachdeepak.com/api/mollie/webhook",
        metadata: { name, email, product: "Main Subscription €29/month" },
      }),
    });

    const payment = await subRes.json();

    // 🧠 Handle possible Mollie API errors
    if (!payment?._links?.checkout?.href) {
      console.error("Payment creation failed:", payment);
      return res.status(400).json({ error: "Failed to create payment" });
    }

    // ✅ Return checkout link to frontend
    res.status(200).json({
      checkoutUrl: payment._links.checkout.href,
      message: "Subscription initiated successfully",
    });

  } catch (err) {
    console.error("❌ Error creating subscription:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
