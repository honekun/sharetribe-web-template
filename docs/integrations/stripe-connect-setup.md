# Stripe Connect setup for the Live marketplace

How to configure the Live Stripe account so sellers can set up their payouts. It is all done in the
Stripe dashboard; no Heroku or Sharetribe Console change is needed. The steps follow Sharetribe's
own Stripe guides (sources at the end).

**Why this exists:** on 2026-10-20, a seller's payout setup on `www.archivovintach.com` failed with
Stripe's error:

> You must complete your platform profile to use Connect and create live connected accounts.

Until the Connect platform profile is complete, Stripe refuses to create sellers' connected
accounts, so no seller can receive money and no purchase can start. Tracked in the
[launch tracker](../pending/live-launch.md) §4 and E2.

**Who:** the Stripe account owner (Fernanda), with the dashboard in **Live mode** (the "Test mode"
switch off). If the dashboard is in Spanish, the labels are the Spanish equivalents.

## 1. Complete the Connect platform profile

1. Open the link from the error, <https://dashboard.stripe.com/connect/accounts/overview>, and click
   the button to finish setting up Connect / the platform profile.
2. **Business model:** choose **Marketplace** and save.
3. Answer the questionnaire as Sharetribe recommends:

   | Question                                   | Answer                                                                                |
   | ------------------------------------------ | ------------------------------------------------------------------------------------- |
   | How money flows                            | **"Buyers will purchase from you"**, then **"Sellers will be paid out individually"** |
   | Account creation (seller onboarding)       | **"Onboarding hosted by Stripe"**                                                     |
   | Account management (seller dashboard)      | **"Build your own with our API"**                                                     |
   | Responsibility for refunds and chargebacks | **Acknowledge** that the platform is responsible                                      |
   | Ongoing verification                       | **Acknowledge** and confirm                                                           |
   | Industry                                   | Clothing / second-hand fashion resale, or the closest option                          |
   | Name on customers' card statements         | The platform: **ARCHIVO VINTACH**                                                     |
   | Who customers contact about disputes       | The platform (Archivo Vintach)                                                        |

4. Skip the optional "Test Connect" and "Integration tutorial" steps, and any prompts about creating
   products.
5. Submit. Stripe says it reviews within **one business day**. Watch the Stripe account's inbox (and
   spam) for requests for more information. If the review takes longer, contact Sharetribe support
   with the Stripe account email and the date you applied.

## 2. Connect payout settings

**⚙ Settings → Connect → Payouts → External accounts**:

- Require at least one bank account? **Yes**
- Allow debit cards? **No**
- Collect multiple external accounts per currency? **No**
- Turn **on** "Collect external account information for accounts where the platform is responsible
  for collecting requirements".

## 3. Enable Accounts V1

Open <https://dashboard.stripe.com/settings/features/feat_accounts_v1_support>, then **Edit → Enable
→ Save**.

If the link sends you to the dashboard home instead, the account is not fully verified yet. Finish
the verification first, then come back.

## 4. Platform payout schedule

Under the platform's bank account and payout settings, Sharetribe recommends a **Manual** payout
schedule for the platform's own account. This is separate from sellers' payouts, which Sharetribe
handles. Check that it is set to Manual.

## 5. Branding (optional, recommended)

**⚙ Settings → Connect → Onboarding interface → Customize**: add the logo, the brand blue `#0f26e4`
and the name, so sellers see Archivo Vintach on Stripe's onboarding pages.

## 6. Check the keys (no change expected)

- Sharetribe **Live** Console → Payments must hold the **`sk_live_…`** secret key, and the Heroku
  build carries the **`pk_live_…`** publishable key (`REACT_APP_STRIPE_PUBLISHABLE_KEY`). Both must
  come from **this same** Stripe account.
- If the Stripe account was ever recreated, update the keys in both places. Changing the Heroku key
  needs a rebuild, because `REACT_APP_*` values are compiled into the browser bundle.
- Never share the secret key in chat, email or tickets; Sharetribe will not add keys for you.

## 7. Retry the seller's setup

Once Stripe confirms the profile is approved, the seller opens their account's payout page on
`www.archivovintach.com` and completes Stripe's hosted onboarding. They will need an official ID,
their bank's 18-digit CLABE, and their tax details; Stripe asks for what Mexico requires.

Then confirm on Live that the seller shows as Stripe-connected (Integration API `users.show` →
`stripeConnected: true`) and record it in launch tracker E2.

## Sources

- [How to set up Stripe for payments on your marketplace](https://www.sharetribe.com/help/en/articles/8413086-how-to-set-up-stripe-for-payments-on-your-marketplace)
  (Sharetribe Help)
- [How to set up Stripe](https://sharetribe.com/docs/the-new-sharetribe/how-to-stripe) (Sharetribe
  docs)
- [Stripe Connect platform review](https://sharetribe.com/docs/how-to/stripe-connect-platform-review)
  (Sharetribe docs)
