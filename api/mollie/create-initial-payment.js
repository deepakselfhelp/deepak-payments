// ✅ Deepak Academy — Create Initial Mollie Payment
// Each checkout creates a *new* customer and *new* mandate
// Used for: initial or one-time payments before subscription activation

export default async function handler(req, res) {
  try {
    const MOLLIE_KEY = process.env.MOLLIE_SECRET_KEY;
    const { name, email, amount, planType } = req.body;

    // --- Basic validation ---
    if (!email || !name || !amount) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // --- Step 1: Create a new Mollie customer every time ---
    console.log("🆕 Creating new Mollie customer:", email);
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
      return res.status(400).json({ error: "Customer creation failed", details: customer });
    }

    // --- Step 2: Create the payment ---
    const payRes = await fetch("https://api.mollie.com/v2/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MOLLIE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: { value: amount, currency: "EUR" },
        description: `${planType || "Membership"} Initial Payment`,
        redirectUrl: "https://did-int-sub.vercel.app/success.html",
        webhookUrl: "https://did-int-sub.vercel.app/api/mollie/webhook",
        customerId: customer.id,
        metadata: { name, email, planType },
      }),
    });

    const payment = await payRes.json();

    // --- Step 3: Handle Mollie response ---
    if (payRes.status !== 201 || !payment._links?.checkout?.href) {
      console.error("❌ Mollie payment error:", payment);
      return res.status(400).json({ error: "Failed to create payment", details: payment });
    }

    console.log(`✅ Payment created for ${email}: ${payment.id}`);
    res.status(200).json({ checkoutUrl: payment._links.checkout.href });

  } catch (err) {
    console.error("❌ create-initial-payment.js error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
