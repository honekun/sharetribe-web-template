# Local test accounts

Use one seller account and one buyer account to exercise the current product-purchase flow locally.
Both accounts must belong to the Sharetribe **Test** environment configured in the local app.

## Prerequisites

- Start the full application with `yarn run dev`, then open `http://localhost:3000`.
- Confirm the local Marketplace API client ID and secret belong to the same Sharetribe Test
  environment.
- Set a Stripe test publishable key (`pk_test_...`) for that environment. Never use live keys for
  local testing.
- Use two email inboxes you can access so both Sharetribe accounts can complete email verification.
- If eShip is enabled locally, use the QA carrier base URL and credentials.

Do not commit local credentials or edit protected environment files as part of a documentation or
test change.

## Seller account

1. Register a new account and select the applicable seller type (`vendedor` or `vendedor-tienda`).
2. Verify the email address.
3. Open **Account settings → Payout details**, or go to `/account/payments`.
4. Create the Stripe Connect account with country **Mexico** (`MX`, the application default) and
   complete Stripe's hosted test onboarding. Use only Stripe-provided test-mode identity and bank
   data; the exact fields can change with Stripe's current onboarding requirements.
5. Confirm Stripe returns to `/account/payments/success`, after which the app redirects to
   `/account/payments` and shows the connected payout status.
6. Open **Account settings → Shipping origin** (`/account/shipping-origin`) and save a complete
   Mexican origin address so eShip can quote the listing.
7. Create and publish a low-price product listing through `/create-type` → **Upload one product**.
   Add the required photos, a valid category, price, stock, and package size.

The listing wizard may prompt for payout details before publishing if the seller skipped step 3.

## Buyer account

1. Use a separate browser profile or private window to avoid sharing the seller session.
2. Register a buyer account and verify its email.
3. Open the seller's listing and click the purchase action.
4. Save a complete shipping address when prompted.
5. Select an available eShip rate and complete checkout with a Stripe test card.

| Scenario           | Card number           | Expiry          | CVC          |
| ------------------ | --------------------- | --------------- | ------------ |
| Success            | `4242 4242 4242 4242` | Any future date | Any 3 digits |
| Declined           | `4000 0000 0000 0002` | Any future date | Any 3 digits |
| 3-D Secure         | `4000 0025 0000 3155` | Any future date | Any 3 digits |
| Insufficient funds | `4000 0000 0000 9995` | Any future date | Any 3 digits |

Use Stripe's current test-card documentation if a scenario changes.

## Verify the flow

- The buyer sees the order at `/order/{transactionId}`.
- The seller sees the sale at `/sale/{transactionId}`.
- The shipping choice is present in transaction `protectedData.avShipping`.
- The seller sees **Generar guía** when `ESHIP_LABEL_AUTOBUY` is unset/`false`, or a purchased label
  after the poller runs when auto-buy is explicitly enabled.
- Stripe Dashboard in test mode shows the payment and connected-account transfer behavior.
- If notifications are enabled, `/api/notifications/readiness` returns `200` and each expected
  delivery is recorded once.

## Relevant implementation

- `src/routing/routeConfiguration.js`
- `src/containers/StripePayoutPage/`
- `src/containers/CheckoutPage/`
- `src/containers/ShippingOriginPage/`
- `server/services/shippingQuoteService.js`
- `server/services/shipmentService.js`

For the complete staging and production verification gates, use the
[release checklist](release-checklist.md).
