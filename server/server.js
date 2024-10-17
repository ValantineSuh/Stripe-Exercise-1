// const express = require("express");
// const app = express();
// const { resolve } = require("path");
// // Replace if using a different env file or config
// const env = require("dotenv").config({ path: "./.env" });

// const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY, {
//   apiVersion: "2022-08-01",
// });

// app.use(express.static(process.env.STATIC_DIR));

// app.get("/", (req, res) => {
//   const path = resolve(process.env.STATIC_DIR + "/index.html");
//   res.sendFile(path);
// });

// app.get("/config", (req, res) => {
//   res.send({
//     publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
//   });
// });

// const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// app.post('/webhook', function(request, response) {
//   const sig = request.headers['stripe-signature'];
//   const body = request.body;

//   let event = null;

//   try {
//     event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
//   } catch (err) {
//     // invalid signature
//     response.status(400).end();
//     return;
//   }

//   let intent = null;
//   switch (event['type']) {
//     case 'payment_intent.succeeded':
//       intent = event.data.object;
//       console.log("Succeeded:", intent.id);
//       break;
//     case 'payment_intent.payment_failed':
//       intent = event.data.object;
//       const message = intent.last_payment_error && intent.last_payment_error.message;
//       console.log('Failed:', intent.id, message);
//       break;
//   }

//   response.sendStatus(200);
// });

// app.post("/create-payment-intent", async (req, res) => {
//   try {
//     const paymentIntent = await stripe.paymentIntents.create({
//       currency: "EUR",
//       amount: 1999,
//       automatic_payment_methods: { 
//         enabled: true 
//       },
//       payment_method_types: ['card'],
//       capture: 'manual',
//     });

//     // Send publishable key and PaymentIntent details to client
//     res.send({
//       clientSecret: paymentIntent.client_secret,
//     });
//   } catch (e) {
//     return res.status(400).send({
//       error: {
//         message: e.message,
//       },
//     });
//   }
// });

// app.listen(5252, () =>
//   console.log(`Node server listening at http://localhost:5252`)
// );


const express = require("express");
const app = express();
const { resolve } = require("path");
const env = require("dotenv").config({ path: "./.env" });
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY, { apiVersion: "2022-08-01" });

app.use(express.static(process.env.STATIC_DIR));

// Parse JSON bodies for all non-webhook routes
app.use(express.json());

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Middleware to read raw body for webhook
app.post('/webhook', express.raw({ type: 'application/json' }), (request, response) => {
  const sig = request.headers['stripe-signature'];
  const body = request.body;

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return response.status(400).send(`Webhook Error: ${err.message}`);
  }

  let intent;
  switch (event.type) {
    case 'payment_intent.succeeded':
      intent = event.data.object;
      console.log("Succeeded:", intent.id);
      break;
    case 'payment_intent.payment_failed':
      intent = event.data.object;
      const message = intent.last_payment_error?.message;
      console.log('Failed:', intent.id, message);
      break;
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  response.status(200).end();
});

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
    const paymentIntent = await stripe.paymentIntents.create({
      currency: "EUR",
      amount: 1999,
      automatic_payment_methods: { enabled: true },
      payment_method_types: ['card'],
      capture: 'manual',
    });

    res.send({ clientSecret: paymentIntent.client_secret });
  } catch (e) {
    res.status(400).send({ error: { message: e.message } });
  }
});

app.listen(5252, () =>
  console.log(`Node server listening at http://localhost:5252`)
);
