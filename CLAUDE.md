# Project Instructions

## Overview

This project is a customized marketplace built on the [Sharetribe Web Template](https://github.com/sharetribe/web-template) (React + SSR). It targets Heroku for production and uses Stripe Connect for payments.

- GitHub: https://github.com/honekun/sharetribe-web-template (account: honekun@gmail.com)
- Upstream: https://github.com/sharetribe/web-template
- Staging: https://archivo-vintach.onrender.com/
- Docs: https://www.sharetribe.com/docs/

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React (SSR via Express) |
| Marketplace backend | Sharetribe Marketplace API |
| Hosting | Heroku (production), Render.com (staging) |
| Payments | Stripe Connect |
| Styling | CSS Modules + custom global styles |
| State management | Redux (ducks pattern) |
| Node | `>=18.20.1 <23.2.0` (see `package.json` engines) |
| Package manager | Yarn |

## Repository Structure

```
/src
  /components       Custom and extended UI components
  /containers       Page-level containers
  /styles           Global and shared style overrides
  /config           Marketplace configuration
  /util             Utilities and helper functions
/server             Express server for SSR
/public             Static assets
.env*               Environment variable files
```

## Coding Conventions

- Follow Sharetribe Web Template conventions: CSS Modules, functional React components, Redux ducks pattern
- Custom components live in `/src/components` and follow existing naming and export patterns
- Client-side environment variables use the `REACT_APP_` prefix; server-side secrets do not
- Keep secrets out of git — manage them via Heroku/Render environment settings
- The app uses SSR — be mindful of server vs. client rendering boundaries
- Avoid introducing new heavy dependencies unless clearly necessary

## Key Config Files

- `src/config/configListing.js` — listing types, fields, categories
- `src/config/configSearch.js` — filters and sorting
- `src/config/configDefault.js` — locale, currency, marketplace metadata

## Payments (Stripe Connect)

- Always use Stripe Connect — never suggest direct charges
- Stripe enables buyer payments, provider payouts via Connect onboarding, and fee splitting via Sharetribe Console
- Production: use live keys (`pk_live_...` / `sk_live_...`)
- Staging (Render.com): use test keys (`pk_test_...` / `sk_test_...`)

Required env vars:
```env
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
```

## Deployment

### Heroku (production)

- Buildpack: `heroku/nodejs`
- `heroku-postbuild` runs the build automatically on deploy
- Ephemeral filesystem — do not write files to disk at runtime; dyno model means no persistent local state
- Deploy: `git push heroku main`

### Render.com (staging)

- URL: https://archivo-vintach.onrender.com/
- Purpose: QA, pre-production review, stakeholder previews
- Free-tier services may cold-start after inactivity
- Env vars managed separately from Heroku; use Stripe test keys here
- Deploy can be manual or branch-driven auto-deploy

## Upstream Sync

Syncs with `sharetribe/web-template` happen frequently. To minimize merge conflicts:

- **Prefer extending over overriding** core template files
- When conflicts arise, review customized areas first: `src/config`, `src/components`, customized containers

```sh
git remote add upstream https://github.com/sharetribe/web-template.git
git fetch upstream
git merge upstream/main
git push origin main
```

## Local Development

```sh
git clone https://github.com/honekun/sharetribe-web-template.git
cd sharetribe-web-template
cp .env-template .env
yarn install
yarn run config
yarn run dev      # frontend + backend dev processes
# or: yarn start  # production-like SSR start
```
