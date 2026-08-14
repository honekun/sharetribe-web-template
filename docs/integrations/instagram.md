# Instagram feed

The `av-insta-feed` block renders the marketplace's Instagram posts. The client calls
`GET /api/instagram/feed`; the server calls the Instagram Graph API with a long-lived access token
and caches the result for an hour.

- Route: `server/api/instagram.js` (mounted from `server/customApiRoutes.js`)
- Token lifecycle: `server/services/instagramTokenService.js`
- Boot + daily refresh: `server/services/instagramTokenRefresh.js`, started in `server/index.js`
- Block: `src/containers/PageBuilder/BlockBuilder/BlockInstagramFeed/`

## The token

A long-lived Instagram token is valid for **60 days** and can only be refreshed **while it is still
valid**. Once it lapses there is no recovery path — it has to be re-minted by hand.

`INSTAGRAM_ACCESS_TOKEN` is only the **seed**. The working token lives in Postgres
(`av_instagram_token`, migration `008_instagram_token.sql`) because a refreshed token has to survive
restarts, and an environment variable cannot be rewritten at runtime.

On boot, and once a day after that, `instagramTokenRefresh` asks the service to refresh when the
token has fewer than 20 days left. Both triggers matter: a Render free-tier service sleeps, so the
daily timer may never fire, and the boot check is what actually keeps it alive there.

Refresh is skipped when `DATABASE_URL` is unset — without somewhere to persist the new value, a
refresh would be lost on restart and would burn the old token.

## Re-minting an expired token

Needed only when the token has already lapsed (`{"ok":false,"error":"token_expired"}` from the API,
`OAuthException` code 190 in the logs).

1. In the Meta app dashboard, generate a new **long-lived** Instagram access token for the connected
   account.
2. Set `INSTAGRAM_ACCESS_TOKEN` to that value on the environment (Render / Heroku) and redeploy or
   restart.
3. On boot the service refreshes the seed immediately and writes the result to `av_instagram_token`,
   putting the 60-day clock under the app's control. Confirm with
   `[instagram] Access token refreshed; valid until …` in the logs.
4. Verify: `curl -s https://<host>/api/instagram/feed | head -c 200` should return `{"ok":true,…}`.

To force the stored token to be re-seeded from the env var, delete the row:

```sql
DELETE FROM av_instagram_token WHERE token_name = 'default';
```

## Failure modes

| Response                    | Status | Meaning                                                                |
| --------------------------- | ------ | ---------------------------------------------------------------------- |
| `{"ok":false,"error":"not_configured"}` | 503 | No token in Postgres and no `INSTAGRAM_ACCESS_TOKEN`.        |
| `{"ok":false,"error":"token_expired"}`  | 503 | Instagram rejected the token — re-mint it (above). Operator action. |
| `{"ok":false,"error":"fetch_failed"}`   | 502 | Transient upstream error; retries on the next request.       |
| `{"ok":false,"error":"rate_limited"}`   | 429 | More than 60 requests a minute from one client.              |

The block renders nothing on any failure, by design — visitors see a clean page rather than a broken
widget. That silence is why an expiry on **2026-06-26** went unnoticed until **2026-08-14**, so the
503/`token_expired` case is logged with the remedy spelled out. Alert on
`[instagram] ACCESS TOKEN REJECTED` or on a non-200 rate from this route.
