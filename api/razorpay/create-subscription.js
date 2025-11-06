// ✅ /api/razorpay/create-subscription.js
// Creates a Razorpay subscription (Test or Live based on env vars)

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { name, email, phone } = req.body;

    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;

    // 🟡 Your Plan ID from Razorpay dashboard (use test plan for testing)
    const plan_id = process.env.RAZORPAY_PLAN_ID || "plan_RaTP2x2MeJxdco";

    // ✅ Subscription Data
    const subscriptionData = {
      plan_id,
      total_count: 400, // large number = effectively "indefinite"
      customer_notify: 1,
      notes: {
        name,
        email,
        phone,
        product: "HindiPro Monthly Subscription (₹699)",
      },
    };

    // ✅ Razorpay API request
    const subResponse = await fetch("https://api.razorpay.com/v1/subscriptions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:
          "Basic " + Buffer.from(`${key_id}:${key_secret}`).toString("base64"),
      },
      body: JSON.stringify(subscriptionData),
    });

    const subscription = await subResponse.json();

    if (subscription.error) {
      console.error("Razorpay error:", subscription.error);
      return res.status(400).json({ error: subscription.error });
    }

    // ✅ Send back to frontend
    res.status(200).json({
      success: true,
      subscription_id: subscription.id,
      plan_id: plan_id,
      key_id: key_id,
      message: "Subscription created successfully",
    });
  } catch (error) {
    console.error("Error creating subscription:", error);
    res.status(500).json({ error: error.message });
  }
}
