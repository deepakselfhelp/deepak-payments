// File: /api/razorpay/create-subscription.js

export default async function handler(req, res) {
  try {
    const { name, email, phone } = req.body;

    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;

    // 🟡 Replace this with your actual plan_id from Razorpay Dashboard
    const plan_id = "plan_RaTP2x2MeJxdco"; 

    // Create the subscription details
    const subscriptionData = {
      plan_id,
      total_count: 400, // e.g., 12 billing cycles (you can remove this for indefinite)
      customer_notify: 1,
      notes: { 
        name, 
        email, 
        phone, 
        product: "HindiPro Subscription (₹699/month)"
      },
    };

    // Send the request to Razorpay API
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
      console.error("Razorpay Error:", subscription.error);
      return res.status(400).json({ error: subscription.error });
    }

    // Send response back to frontend
    res.status(200).json({
      id: subscription.id,
      key: key_id,
      name,
      email,
      phone,
      product: "HindiPro Subscription (₹699/month)",
      message: "Subscription created successfully.",
    });

  } catch (err) {
    console.error("Error creating subscription:", err);
    res.status(500).json({ error: "Failed to create subscription" });
  }
}
