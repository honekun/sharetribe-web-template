# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Customized marketplace ("Archivo Vintach") built on the [Sharetribe Web Template](https://github.com/sharetribe/web-template) (React + Express SSR). Fork of `sharetribe/web-template`, deployed to Heroku (production) and Render.com (staging). Uses Stripe Connect for payments via Sharetribe Marketplace API.

- GitHub: https://github.com/honekun/sharetribe-web-template
- Upstream: https://github.com/sharetribe/web-template
- Staging: https://archivo-vintach.onrender.com/
- Docs: https://www.sharetribe.com/docs/

## Commands

```sh
yarn run dev              # Frontend (port 3000) + backend API server (port 3500) concurrently
yarn run dev-frontend     # Frontend only (webpack-dev-server via sharetribe-scripts)
yarn run dev-backend      # Backend API server only (nodemon)
yarn run dev-server       # Full production-like SSR with hot reload (port 4000)
yarn start                # Production server (node server/index.js)

yarn run build            # Build web bundle + server (build-web && build-server)
yarn run clean            # Remove build directory

yarn test                 # Frontend tests (Jest + React Testing Library, interactive watch mode)
yarn test -- --watchAll=false              # Run all tests once (no watch)
yarn test -- --testPathPattern=auth        # Run tests matching "auth" in path
yarn test -- --testNamePattern="login"     # Run tests matching "login" in name
yarn test-server                           # Server tests only (jest ./server/**/*.test.js)
yarn test-ci                               # CI: server tests then client tests (--runInBand)

yarn run format           # Prettier (JS + CSS)
yarn run format-ci        # Check formatting without modifying
yarn run config           # Config validation/setup wizard
yarn run translate        # Translation management
```

**Node:** `>=18.20.1 <23.2.0` | **Package manager:** Yarn

## Architecture

### Routing & Data Loading

Routes defined in `src/routing/routeConfiguration.js` — each route specifies a `path`, `name` (used by `NamedLink`/`NamedRedirect`), a `@loadable/component` for code-splitting, and an optional `loadData` thunk for SSR data prefetching.

The `loadData` pattern is critical: server calls `loadData` before rendering (via `server/dataLoader.js`), and the client calls it again on mount/navigation (via `RouteComponentRenderer` in `src/routing/Routes.js`). Each container exports its `loadData` through `src/containers/pageDataLoadingAPI.js`.

### Redux (Ducks Pattern)

State is organized as Redux ducks — self-contained modules with action types, creators, reducers, and selectors in a single file. Uses `@reduxjs/toolkit` (`createSlice`, `createAsyncThunk`).

- **Global ducks** in `src/ducks/`: `auth`, `user`, `routing`, `ui`, `stripe`, `stripeConnectAccount`, `paymentMethods`, `marketplaceData` (normalized entities), `hostedAssets`, `emailVerification`
- **Container ducks** colocated: `src/containers/SearchPage/SearchPage.duck.js`, etc.
- SDK instance is injected as `thunkAPI.extra` in async thunks
- Entities (listings, users, transactions) are normalized in `marketplaceData.duck.js`; containers hold references by ID
- Errors serialized via `storableError()` util

### SSR (Server-Side Rendering)

Express server in `/server/`. Key files:
- `server/index.js` — middleware stack (helmet, CSP, compression, auth, API routes, renderer)
- `server/renderer.js` — creates Redux store, renders React to string with `StaticRouter`, injects state into HTML
- `server/dataLoader.js` — matches URL to route, calls `loadData` before render
- `server/auth.js` — Passport for social auth (Facebook, Google)
- `server/api-util/sdk.js` — server-side SDK instantiation with token store from cookies
- `server/api-util/cache.js` — in-memory LRU cache (Heroku-safe, ephemeral)
- `server/csp.js` — Content Security Policy configuration

**SSR constraint:** Guard all browser APIs (`window`, `document`, `localStorage`) behind `typeof window !== 'undefined'` checks.

### Container/Page Pattern

Each page container has:
1. **Component** (`PageName.js`) — React component with `mapStateToProps`, wrapped via `compose(connect(...))`
2. **Duck** (`PageName.duck.js`) — Redux state, `loadData` thunk, SDK calls
3. **Styles** (`PageName.module.css`) — CSS Modules
4. Optional sub-components in subdirectories

### PageBuilder (CMS-Driven Pages)

`src/containers/PageBuilder/` renders dynamic pages from Sharetribe hosted assets (JSON from Console CMS).

- `PageBuilder.js` — orchestrator
- `SectionBuilder/SectionBuilder.js` — maps section configs to components; parses section name for display options (e.g., `"Hero - Large"` → large variant)
- 11 section types in `SectionBuilder/Section*/` (7 upstream + 4 custom AV sections)
- Custom sections registered via `options.sectionComponents` prop
- Section appearance encoded in `sectionName` string: `Large/Medium`, `FullH/FullW`, `SmallerTitle`, `TextGray`, etc.

### Transaction Processes

4 transaction types defined in `src/transactions/transaction.js`:
- **Purchase** (`default-purchase`) — one-time buy, unit type: ITEM
- **Booking** (`default-booking`) — time-based, unit types: DAY/NIGHT/HOUR/FIXED
- **Inquiry** (`default-inquiry`) — contact only, unit type: INQUIRY
- **Negotiation** (`default-negotiation`) — offer/counter-offer, unit types: OFFER/REQUEST

Each has a state machine in `src/transactions/transactionProcess*.js`. CheckoutPage dispatches to either `CheckoutPageWithPayment` (Stripe) or `CheckoutPageWithInquiryProcess`.

### API Integration (Sharetribe SDK)

- Package: `sharetribe-flex-sdk`
- Client-side wrapper: `src/util/sdkLoader.js`
- Server-side: `server/api-util/sdk.js`
- Token management: HttpOnly cookies via `expressCookieStore`, auto-refresh by SDK
- Hosted assets (CMS content, translations) fetched via `sdk.assets.search()`, cached 1hr server-side

### Config System

Files in `src/config/`: `configDefault.js`, `configListing.js`, `configSearch.js`, `configStripe.js`, `configUser.js`, `configLayout.js`, `configBranding.js`, `configMaps.js`, etc.

Built-in config is merged with hosted config from Sharetribe assets at runtime via `src/util/configHelpers.js`. Access in components via `useConfiguration()` hook from `src/context/configurationContext`.

### Styling

- **CSS Modules** (`*.module.css`) for component-scoped styles — use `className={css.root}`
- **Global styles** in `src/styles/`: `marketplaceDefaults.css` (base variables), `avBrandOverrides.css` (AV brand), `customMediaQueries.css` (breakpoints)
- **CSS custom properties** for theming: `--marketplaceColor`, `--marketplaceColorDark`, `--marketplaceColorLight`
- **Dark theme** applied via `css.darkTheme` class when section has `textColor: 'white'`
- Conditional classes via `classnames` package

## Custom AV Components

- `src/components/AVListingCard/` — custom listing card
- `src/components/FieldSwatch/` — color swatch display (14 color mappings keyed to listing enum values)
- `src/components/NewsletterForm/` — Brevo email subscribe form; posts to `/api/brevo/subscribe`
- `src/components/PricingToggle/` — shared pricing plan card UI; used by both `BlockPriceSelector` and `SectionPriceSelector`

Custom PageBuilder sections (in `src/containers/PageBuilder/SectionBuilder/`):
- `SectionHeroCustom/` — gradient hero banner
- `SectionPriceSelector/` — interactive pricing selector (data from hosted asset `content/pricing-plans.json`)
- `SectionSelectedListings/` — hand-picked listing carousel
- `SectionRecommendedListings/` — auto-fetched listing grid

Custom PageBuilder blocks (in `src/containers/PageBuilder/BlockBuilder/`):
- `BlockPriceSelector/` — block variant of pricing selector
- `BlockWithCols/` — two-column text block

Custom pages: `MakeOfferPage`, `RequestQuotePage`, `ManageAccountPage` (negotiation flow)

### LandingPage Extension Pattern

Core `LandingPage.js` and `LandingPage.duck.js` are kept upstream-like. All AV customizations go through extension hooks in `src/extensions/landingPage/`. Register new extensions in `registry.js` — do not modify `LandingPage.js` directly.

Extension hooks: `loadDataExtension`, `selectExtensionProps`, `getPageBuilderOptions`, `transformPageData`.

### CMSPage Pricing Asset

`CMSPage.duck.js` fetches pricing plan data from `content/pricing-plans.json` (Sharetribe hosted asset) alongside the page JSON. Data is stored in `state.CMSPage.pricingPlansData`. The component falls back to intl-based data if the asset doesn't exist yet. See `ai_notes.md` Section 4 for the JSON schema and pending setup steps.

## Coding Conventions

- Follow Sharetribe Web Template conventions: CSS Modules, functional React, Redux ducks
- Client-side env vars use `REACT_APP_` prefix; server-side secrets do not
- Prefer extending over overriding core template files (reduces upstream merge conflicts)
- Always use Stripe Connect — never direct charges
- Heroku has ephemeral filesystem — never write files to disk at runtime

## Deployment

- **Production (Heroku):** `git push heroku main` — `heroku-postbuild` runs `yarn build`
- **Staging (Render.com):** use Stripe test keys (`pk_test_`/`sk_test_`); may cold-start after inactivity

## Upstream Sync

```sh
git remote add upstream https://github.com/sharetribe/web-template.git
git fetch upstream
git merge upstream/main
```

When resolving conflicts, review customized areas first: `src/config`, `src/components`, customized containers, `src/extensions/`.

High-conflict files to watch: `SearchResultsPanel.js` (AVListingCard swap), `CMSPage.js` (custom section injection), `marketplaceDefaults.css` (AV brand colors).
