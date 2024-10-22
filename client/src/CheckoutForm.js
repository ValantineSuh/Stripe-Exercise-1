
import { PaymentElement } from "@stripe/react-stripe-js";
import { useState, useEffect } from "react";
import { useStripe, useElements } from "@stripe/react-stripe-js";

export default function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();

  const [message, setMessage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Fetch the balance history from the server
    fetch("/balance-history")
      .then((response) => response.json())
      .then((data) => {
        console.log("Balance:", data.totalBalance);  // Log total balance
        console.log("Transactions:", data.transactions);  // Log transactions
      })
      .catch((error) => {
        console.error("Error fetching balance history:", error);
      });
  }, []);

  useEffect(() => {
    const paymentIntentId = 'pi_3QCIULHcq0BpKt6r0Wysjn3I';  // Replace this with your actual payment intent ID
    
    fetch(`/payment-intent/${paymentIntentId}`)
      .then((response) => response.json())  // Correctly calling the .json() method
      .then((data) => {
        if (data.charges && data.charges.data.length > 0) {
          console.log("Expanded Balance Transaction:", data.charges.data[0].balance_transaction);
        } else {
          console.log("No charges found for this PaymentIntent.");
        }
      })
      .catch((e) => {
        console.log("Error fetching payment intent:", e);
      });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      // Stripe.js has not yet loaded.
      // Make sure to disable form submission until Stripe.js has loaded.
      return;
    }

    setIsProcessing(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // Make sure to change this to your payment completion page
        return_url: `${window.location.origin}/completion`,
      },
    });

    if (error) {
      setMessage(error.message || "An unexpected error occurred.");
    } else {
      setMessage("Payment successful!");
    }

    setIsProcessing(false);
  };

  return (
    <form id="payment-form" onSubmit={handleSubmit}>
      <PaymentElement id="payment-element" />
      <button disabled={isProcessing || !stripe || !elements} id="submit">
        <span id="button-text">
          {isProcessing ? "Processing ..." : "Pay now"}
        </span>
      </button>
      {/* Show any error or success messages */}
      {message && <div id="payment-message">{message}</div>}
    </form>
  );
}