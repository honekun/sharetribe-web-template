# Sharetribe Web Template (Customized)

[![CircleCI](https://circleci.com/gh/sharetribe/web-template.svg?style=svg)](https://circleci.com/gh/sharetribe/web-template)

This repository is based on the official [Sharetribe Web Template](https://github.com/sharetribe/web-template) and extended for a customized marketplace deployment on Heroku with Stripe Connect.

## Links & References

- [Project GitHub Repository](https://github.com/honekun/sharetribe-web-template)
- [Staging Environment on Render.com](https://archivo-vintach.onrender.com/)
- [Sharetribe Web Template GitHub](https://github.com/sharetribe/web-template)
- [Sharetribe Developer Docs](https://www.sharetribe.com/docs/)
- [Stripe Connect Docs](https://stripe.com/docs/connect)
- [Heroku Node.js Deployment Guide](https://devcenter.heroku.com/articles/deploying-nodejs)

## Project Overview

- Base: Sharetribe Web Template (React + SSR)
- Marketplace backend: Sharetribe Marketplace API
- Hosting: Heroku (production)
- Testing/staging host: Render.com
- Payments: Stripe Connect
- Styling: CSS Modules + custom global styles
- State management: Redux (template default)
- Node version: `>=18.20.1 <23.2.0` (from `package.json`)

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend framework | React (via Sharetribe Web Template) |
| Marketplace backend | Sharetribe Marketplace API |
| Hosting | Heroku |
| Payments | Stripe Connect |
| Styling | CSS Modules + custom global styles |
| State management | Redux |
| Node | 18.x+ (see `package.json` engines) |

## Repository & Upstream

- Project repository: [https://github.com/honekun/sharetribe-web-template](https://github.com/honekun/sharetribe-web-template)
- Upstream template: [https://github.com/sharetribe/web-template](https://github.com/sharetribe/web-template)
- This fork is synced with upstream regularly to keep template fixes and updates current.

## Repository Structure

```text
/src
  /components          Custom and extended UI components
  /containers          Page-level containers
  /styles              Global and shared style overrides
  /config              Marketplace configuration
  /util                Utilities and helper functions
/server                Express server for SSR
/public                Static assets
.env*                  Environment variable files
```

## Quick Start

### Local setup

Install [Node.js](https://nodejs.org/) and [Yarn](https://yarnpkg.com/), then run:

```sh
git clone https://github.com/honekun/sharetribe-web-template.git
cd sharetribe-web-template
cp .env-template .env
yarn install
yarn run config
yarn run dev
```

Notes:
- `yarn run dev` runs frontend and backend development processes.
- For SSR production-like start locally, use `yarn start`.

### Windows users

Use [Windows Subsystem for Linux (WSL)](https://docs.microsoft.com/en-us/windows/wsl/about). The template and docs are Unix-oriented.

## Environment Configuration

Configure environment variables in local env files and Heroku/Render environment settings. Typical required keys include:

```env
NODE_ENV=production
REACT_APP_SHARETRIBE_SDK_CLIENT_ID=...
SERVER_SHARETRIBE_SDK_CLIENT_SECRET=...
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
REACT_APP_MAPBOX_ACCESS_TOKEN=...
```

Additional variables for the notification system (AV-noti):

```env
# Sharetribe Integration API (Console → Build → Integrations)
SHARETRIBE_INTEGRATION_CLIENT_ID=
SHARETRIBE_INTEGRATION_CLIENT_SECRET=

# WhatsApp Meta Cloud API
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ADMIN_PHONE=+521XXXXXXXXXX

# Brevo transactional email sender
BREVO_SENDER_EMAIL=hola@archinovintach.com
BREVO_SENDER_NAME=Archivo Vintach
```

Notes:
- Client-side variables use the `REACT_APP_` prefix.
- Keep secrets only in secure environment configuration (never in git).
- Use Stripe test keys (`pk_test_...` / `sk_test_...`) in staging.
- AV-noti is silently disabled if `SHARETRIBE_INTEGRATION_CLIENT_ID` is absent — the server starts normally.

## Customization Areas

### Components and UI

Project-specific additions include patterns such as:

- `HeroSection`
- `CategoryGrid`
- `FeaturedListings`
- `TrustBadges`
- `CustomFooter`
- `ReviewSummary`

### My Purchases & My Sales

Dedicated pages for transaction history, accessible from the profile menu and UserNav tab bar:

- `/my-purchases` — Lists all transactions where the current user is the buyer
- `/my-sales` — Lists all transactions where the current user is the seller

Both pages reuse the `InboxItem` component from InboxPage for consistent transaction row rendering, include pagination, and support SSR. Links appear in the desktop profile dropdown, mobile menu, and the horizontal tab navigation (UserNav) alongside "Your listings".

### My Balance (Seller Financial Dashboard)

A seller-focused financial dashboard at `/my-balance` providing consolidated financial visibility:

- **Balance summary cards** — Total Earnings (sum of completed sale payouts), Pending (in-progress payouts), and Cancelled count, displayed as color-coded cards at the top of the page
- **Transaction filters** — URL-param-based filters for status (Completed/Pending/Cancelled), transaction type (Purchase/Booking/Negotiation), and date range. Filter state is persisted in the URL for shareable/bookmarkable filtered views
- **Payout history** — Paginated list of sale transactions showing listing title, buyer name, date, gross and net amounts, and status badges

Balance totals are computed client-side from `sdk.transactions.query()` responses (there is no direct Stripe balance API through Sharetribe SDK). The page shares the same `LayoutSideNavigation` + `UserNav` layout pattern as My Purchases and My Sales.

### Notification System (AV-noti)

Event-driven notifications triggered by Sharetribe Integration API events. The Express server polls for new events every 5 minutes and fires:

- **Welcome email** — branded Brevo transactional email with a Getting Started PDF attached, sent on `user/created`
- **WhatsApp messages** — Meta Cloud API template messages to users and the admin on registration, purchases, deliveries, cancellations, and new messages

Requires a Sharetribe Integration (Console → Build → Integrations), a Meta WhatsApp Business Account with pre-approved message templates, and the env vars listed in the Environment Configuration section above.

All notification logic lives in `server/services/`. The system is opt-in: if `SHARETRIBE_INTEGRATION_CLIENT_ID` is not set, the poller is skipped and the server runs normally.

### Listing Form Customizations

The listing creation and edit forms include three enhancements:

- **Two-column layout** — The Details, Delivery, and Location panels use a responsive CSS grid that displays fields in two columns on desktop (768px+) and a single column on mobile.
- **Labeled image slots** — The Photos panel replaces the free-form image gallery with 4 fixed upload positions (Front, Back, Horizontal, Details) in a 2x2 grid. Only the front photo is required. The slot mapping is saved to `publicData.imageSlots` and displayed as labels in the listing detail gallery.
- **Earnings estimator** — The Pricing panel shows estimated seller earnings below the price input, breaking down the marketplace commission and Stripe processing fees. Fee percentages are configurable via environment variables:

```env
REACT_APP_PROVIDER_COMMISSION_PERCENTAGE=10    # Marketplace fee (default: 10%)
REACT_APP_STRIPE_FEE_PERCENTAGE=2.9            # Stripe fee (default: 2.9%)
REACT_APP_STRIPE_FEE_FIXED_AMOUNT=30           # Stripe fixed fee in sub-units/cents (default: 30)
```

### Style customization

- Brand color palette overrides
- Custom typography
- Mobile-first responsive adjustments
- Custom button and form styles
- Listing card interaction and hover treatments

### Template config customization

- `src/config/configListing.js`: listing types, fields, categories
- `src/config/configSearch.js`: filters and sorting
- `src/config/configDefault.js`: locale, currency, marketplace metadata

## Stripe Integration

Stripe is configured using Stripe Connect (Sharetribe standard model), enabling:

- Buyer payments through Stripe hosted UI
- Provider payouts via Connect onboarding
- Transaction fee splitting via Sharetribe Console
- Webhook-based payment status updates

Required Stripe keys:

```env
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
```

## Deployment

### Heroku (production)

This project is set up for Node.js deployment on Heroku with SSR.

Deploy:

```sh
git push heroku main
```

`heroku-postbuild` runs build automatically during deploy.

Configuration guidance:
- Buildpack: `heroku/nodejs`
- Node version: from `package.json` `engines`
- Dyno: choose based on production traffic
- Optional add-ons: logging/monitoring and data services as needed

### Render.com (staging/testing)

Staging environment:
- URL: [https://archivo-vintach.onrender.com/](https://archivo-vintach.onrender.com/)
- Purpose: QA, pre-production review, stakeholder previews

Operational notes:
- Free-tier services may cold-start after inactivity
- Render environment variables are managed separately from Heroku
- Use Stripe test mode keys in Render
- Deploy can be manual or branch-driven auto-deploy

## Upstream Sync Workflow

If `upstream` remote is not configured:

```sh
git remote add upstream https://github.com/sharetribe/web-template.git
```

Sync latest template changes:

```sh
git fetch upstream
git merge upstream/main
git push origin main
```

When resolving conflicts, review customized areas first (`src/config`, `src/components`, customized containers).

## AI Assistant Notes

For AI-assisted development in this repo:

- Follow Sharetribe template conventions (CSS Modules, functional components, Redux patterns)
- Keep Stripe integrations compatible with Sharetribe Connect flow
- Keep Heroku runtime constraints in mind (ephemeral filesystem, dyno model)
- Use Render as staging context and Stripe test keys there
- Upstream syncs are frequent: prefer extension over deep core-template modification to reduce merge conflicts
- Respect SSR boundaries between server and client code
- Avoid introducing heavy dependencies without clear need

## Sharetribe Docs and Support

- [Getting started with Sharetribe Web Template](https://www.sharetribe.com/docs/introduction/getting-started-with-web-template/)
- [Environment configuration variables](https://www.sharetribe.com/docs/template/template-env/)
- [How to customize the template](https://www.sharetribe.com/docs/template/how-to-customize-template/)
- [How to deploy to production](https://www.sharetribe.com/docs/template/how-to-deploy-template-to-production/)
- [Developer Docs](https://www.sharetribe.com/docs/)
- Developer Slack: https://www.sharetribe.com/dev-slack
- [Sharetribe Expert Network](https://www.sharetribe.com/experts/)

## License

This project is licensed under Apache-2.0.

See [LICENSE](LICENSE).
