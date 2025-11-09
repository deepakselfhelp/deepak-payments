// ✅ Deepak Academy — Mollie Initial Payment (Final Version)
// Always creates a fresh customer + payment + new mandate per checkout

export default async function handler(req, res) {
  try {
    const MOLLIE_KEY = process.env.MOLLIE_SECRET_KEY;
    const { name, email, amount, planType } = req.body;

    // 🔒 Basic validation
    if (!email || !name || !amount) {
      console.error("❌ Missing fields:", { name, email, amount });
      return res.status(400).json({ error: "Missing required fields" });
    }

    // -------------------------------------------------------------------
    // 1️⃣ Create new Mollie Customer (always new, no reuse)
    // -------------------------------------------------------------------
    console.log("🆕 Creating Mollie customer for:", email);

    const newCustRes = await fetch("https://api.mollie.com/v2/customers", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MOLLIE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, email }),
    });

    const customer = await newCustRes.json();

    if (!customer?.id) {
      console.error("❌ Customer creation failed:", customer);
      return res.status(400).json({ error: "Customer creation failed" });
    }

    console.log(`✅ Mollie Customer Created: ${customer.id}`);

    // -------------------------------------------------------------------
    // 2️⃣ Create Initial Payment — triggers mandate creation
    // -------------------------------------------------------------------
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
        metadata: {
          name,
          email,
          planType,
          type: "initialPayment",
        },
        sequenceType: "first", // ensures a new mandate is created
      }),
    });

    const payment = await payRes.json();

    // -------------------------------------------------------------------
    // 3️⃣ Validate and Return Checkout URL
    // -------------------------------------------------------------------
    if (payRes.status !== 201 || !payment._links?.checkout?.href) {
      console.error("❌ Mollie Payment Error:", payment);
      return res.status(400).json({
        error: "Failed to create payment",
        details: payment,
      });
    }

    console.log(`✅ Mollie Payment Created: ${payment.id}`);
    res.status(200).json({
      checkoutUrl: payment._links.checkout.href,
      customerId: customer.id,
      paymentId: payment.id,
    });
  } catch (err) {
    console.error("❌ create-initial-payment.js error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
