// ✅ /api/mollie/create-initial-payment.js
export default async function handler(req, res) {
  try {
    const MOLLIE_KEY = process.env.MOLLIE_SECRET_KEY;
    const { name, email, amount, planType } = req.body;

    if (!name || !email || !amount) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // --- Step 1: Always create a new customer ---
    const custRes = await fetch("https://api.mollie.com/v2/customers", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MOLLIE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, email }),
    });

    const customer = await custRes.json();
    if (!customer?.id) {
      console.error("❌ Customer creation failed:", customer);
      return res.status(400).json({ error: "Customer creation failed" });
    }

    // --- Step 2: Create the initial payment ---
    const payRes = await fetch("https://api.mollie.com/v2/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MOLLIE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: { value: amount, currency: "EUR" },
        description: `${planType || "Deepak Academy"} Initial Payment`,
        redirectUrl: "https://checkout.realcoachdeepak.com/success.html",
        webhookUrl: "https://checkout.realcoachdeepak.com/api/mollie/webhook",
        customerId: customer.id,
        metadata: { name, email, planType },
      }),
    });

    const payment = await payRes.json();
    if (payRes.status !== 201 || !payment._links?.checkout?.href) {
      console.error("❌ Mollie payment error:", payment);
      return res.status(400).json({ error: "Failed to create payment", details: payment });
    }

    console.log(`✅ Payment created: ${payment.id} for ${email}`);
    res.status(200).json({ checkoutUrl: payment._links.checkout.href });

  } catch (err) {
    console.error("❌ create-initial-payment.js error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
