const express = require("express");
const app = express();
const { resolve } = require("path");
require("dotenv").config({ path: "./.env" });

const { v4: uuidv4 } = require('uuid');
const crypto = require("crypto");  // For generating unique idempotency keys

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-04-10",
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

app.get("/balance-history", async (req, res) => {
  try {
    // **NEW: Fetch the account balance**
    const balance = await stripe.balance.retrieve();

    // **NEW: Fetch the balance transaction history**
    const transactions = await stripe.balanceTransactions.list({
      limit: 5, // You can adjust this limit based on your need
    });
    console.log("Transactions:", transactions);
    console.log("Balance:", balance);

    // **NEW: Send the balance and transactions to the client**
    res.send({
      totalBalance: balance.available, // Available balance
      transactions: transactions.data,  // List of transactions
    });
  } catch (e) {
    res.status(400).send({
      error: {
        message: e.message,
      },
    });
  }
});

// app.post("/create-payment-intent", async (req, res) => {
//   try {
//     const customer = await stripe.customers.create({
//       name: "Jenny Rosen",
//       email: "jennyrosen@example.com",
//     });

//     // Generate a unique idempotency key
//     const idempotencyKey = uuidv4();
//     console.log("Generated Idempotency Key:", idempotencyKey); // Log the key

//     const paymentIntent = await stripe.paymentIntents.create({
//       customer: customer.id,
//       currency: "EUR",
//       amount: 1999,
//       // setup_future_usage: "off_session",
//       // automatic_payment_methods: { enabled: true },
//       payment_method_types: ["card"],
//       // capture_method: "manual",
//       metadata: {
//         order_id: '77',
//       },
//     }, {
//       idempotencyKey: idempotencyKey,  // Pass the idempotency key here
//     });

//     // const refund = await stripe.refunds.create({
//     //   payment_intent: 'pi_3QBHpAHcq0BpKt6r1p6FjD87',
//     //   amount: 1000,
//     // });

//     res.send({
//       clientSecret: paymentIntent.client_secret,
//     });
//   } catch (e) {
//     res.status(400).send({ error: { message: e.message } });
//   }
// });

const idempotencyKeysUsed = new Set(); // Store used keys

app.post("/create-payment-intent", async (req, res) => {
  try {
    // Use the idempotency key provided in the request header or generate a new one
    const idempotencyKey = req.headers["idempotency-key"] || crypto.randomBytes(16).toString("hex");

    // Log and check if the key has already been used
    if (idempotencyKeysUsed.has(idempotencyKey)) {
      console.log("Reused Idempotency Key:", idempotencyKey);
    } else {
      console.log("New Idempotency Key:", idempotencyKey);
      idempotencyKeysUsed.add(idempotencyKey); // Add the new key to the set
    }

    const paymentIntent = await stripe.paymentIntents.create(
      {
        currency: "USD",
        amount: 1999,
        automatic_payment_methods: { enabled: true },
        expand: ["charges.data.balance_transaction"],
      },
      {
        idempotencyKey: idempotencyKey, // Use the idempotency key here
      }
    );

    console.log("Created PaymentIntent:", paymentIntent); // Log the PaymentIntent

    if (paymentIntent.charges.data.length > 0) {
      console.log("Funds will be available on:", paymentIntent.charges.data[0].balance_transaction.available_on);
    } else {
      console.log("No charges were created for this PaymentIntent.");
    }

    // Send clientSecret and idempotencyKey to the client
    res.send({
      clientSecret: paymentIntent.client_secret,
      idempotencyKey: idempotencyKey,
    });
  } catch (e) {
    console.error("Error creating payment intent:", e);
    res.status(400).send({ error: { message: e.message } });
  }
});

app.get("/payment-intents-and-charges", async (req, res) => {
  const requestId = uuidv4(); // Unique request ID
  console.log("Request ID:", requestId);
  
  try {
    const paymentIntents = [];
    const charges = [];

    // Auto-paginate through PaymentIntents
    for await (const intent of stripe.paymentIntents.list({ limit: 100 })) {
      paymentIntents.push(intent);
    }

    // Auto-paginate through Charges
    for await (const charge of stripe.charges.list({ limit: 100 })) {
      charges.push(charge);
    }

    const totalPaymentIntents = paymentIntents.length;
    const totalCharges = charges.length;

    // Log the operation in Stripe's dashboard by creating a PaymentIntent with metadata
    const logResponse = await stripe.paymentIntents.create({
      amount: 100, // Minimal amount to avoid actual charge
      currency: "usd",
      metadata: {
        operation: "payment-intents-and-charges-fetch",
        requestId: requestId,
        totalPaymentIntents: totalPaymentIntents,
        totalCharges: totalCharges,
      },
    });

    console.log("Operation logged in Stripe with PaymentIntent ID:", logResponse.id);

    // Send response with totals and request ID
    res.send({
      requestId: requestId,
      totalPaymentIntents: totalPaymentIntents,
      totalCharges: totalCharges,
      paymentIntents: paymentIntents,
      charges: charges,
      logResponseId: logResponse.id,
    });
  } catch (error) {
    res.status(400).send({
      error: {
        message: error.message,
        requestId: requestId,
      },
    });
  }
});


app.get("/payment-intent/:id", async (req, res) => {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(req.params.id, {
      expand: ['charges.data.balance_transaction']  // Expanding balance transaction
    });

    // Check if there are charges and then log the balance transaction
    if (paymentIntent.charges && paymentIntent.charges.data.length > 0) {
      console.log("Expanded Balance Transaction:", paymentIntent.charges.data[0].balance_transaction);
    } else {
      console.log("No charges found for this PaymentIntent.");
    }

    res.send(paymentIntent);  // Send the response back to the client
  } catch (e) {
    res.status(400).send({ error: { message: e.message } });
  }
});

app.listen(5252, () =>
  console.log(`Node server listening at http://localhost:5252`)
);
