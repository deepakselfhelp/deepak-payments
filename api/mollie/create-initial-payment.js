// ✅ /api/create-initial-payment.js
export default async function handler(req, res) {
  try {
    const MOLLIE_KEY = process.env.MOLLIE_SECRET_KEY;
    const { name, email, initialAmount, recurringAmount, planType } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: "Missing name or email" });
    }

    // 🧍 1️⃣ Create or reuse customer
    const custRes = await fetch("https://api.mollie.com/v2/customers", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MOLLIE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, email }),
    });
    const customer = await custRes.json();

    // 💶 2️⃣ Create initial payment
    const payRes = await fetch("https://api.mollie.com/v2/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MOLLIE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: { value: initialAmount, currency: "EUR" },
        description: `${planType} Initial Payment`,
        redirectUrl: "https://checkout.realcoachdeepak.com/success.html",
        webhookUrl: "https://checkout.realcoachdeepak.com/api/mollie/webhook",
        customerId: customer.id,
        sequenceType: "first",
        metadata: { name, email, recurringAmount, planType },
      }),
    });

    const payment = await payRes.json();
    console.log("✅ Mollie initial payment created:", payment.id);
    res.status(200).json({ checkoutUrl: payment._links.checkout.href });
  } catch (err) {
    console.error("❌ create-initial-payment error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

