const express = require("express");
const app = express();
const { resolve } = require("path");
require("dotenv").config({ path: "./.env" });

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2022-08-01",
});

app.use(express.json());
app.use(express.static(process.env.STATIC_DIR));

app.get("/", (req, res) => {
  const path = resolve(process.env.STATIC_DIR + "/index.html");
  res.sendFile(path);
});

app.get("/config", (req, res) => {
  res.send({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  });
});

app.post("/create-payment-intent", async (req, res) => {
  try {
    const customer = await stripe.customers.create({
      name: "Jenny Rosen",
      email: "jennyrosen@example.com",
    });

    const paymentIntent = await stripe.paymentIntents.create({
      customer: customer.id,
      currency: "EUR",
      amount: 1999,
      // setup_future_usage: "off_session",
      payment_method_types: ["card"],
      // capture_method: "manual",
    });

    // const refund = await stripe.refunds.create({
    //   payment_intent: 'pi_3QBHpAHcq0BpKt6r1p6FjD87',
    //   amount: 1000,
    // });

    res.send({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (e) {
    res.status(400).send({ error: { message: e.message } });
  }
});

app.listen(5252, () =>
  console.log(`Node server listening at http://localhost:5252`)
);
