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

Notes:
- Client-side variables use the `REACT_APP_` prefix.
- Keep secrets only in secure environment configuration (never in git).
- Use Stripe test keys (`pk_test_...` / `sk_test_...`) in staging.

## Customization Areas

### Components and UI

Project-specific additions include patterns such as:

- `HeroSection`
- `CategoryGrid`
- `FeaturedListings`
- `TrustBadges`
- `CustomFooter`
- `ReviewSummary`

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
