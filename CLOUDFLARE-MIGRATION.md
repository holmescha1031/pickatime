# Cloudflare migration and vote authorization

This branch prepares a new Cloudflare deployment. It does **not** change live Firebase rules or redirect the existing Vercel site. Do not claim the live database is secured until the new rules are published and verified.

## Runtime secrets and identity

In the Cloudflare Worker settings, register these as encrypted **Secrets** (not build variables):

- `KAKAO_REST_API_KEY`: the existing Kakao REST key.
- `KAKAO_CLIENT_SECRET`: **the same existing secret**. Rotating it changes private profile/index HMAC keys and loses access to existing account lists, deletion markers and admin configuration. Do not generate a replacement for migration.
- `FIREBASE_SERVICE_ACCOUNT_JSON`: JSON service account key for Firebase project **pickatime-meet**, with Firebase Realtime Database Admin permissions. This is not the separate Calendar OAuth project. It signs Firebase custom tokens and authenticates actual meeting erasure.

Set the non-secret runtime variable `SITE_ORIGIN` to the exact new HTTPS origin, without a path (for example the purchased domain). Never expose these secrets in chat, GitHub, client config or build logs. `keep_vars` preserves dashboard-managed variables across deploys.

In Firebase Authentication, initialize the service if not already enabled. Custom authentication uses the server-issued token; no anonymous provider is needed. Add the new hostname to Authentication authorized domains. The signing service account must belong to pickatime-meet.

## Build/deploy

Connect **holmescha1031/pickatime** in Cloudflare Workers & Pages, select this branch for initial migration testing, root `/`, build `npm run build:cloudflare`, deploy `npx wrangler deploy`. The dependency range installs current compatible Wrangler v4. Run `npm run check:cloudflare` in the build environment for the native bundle/dry-run check, and `npx wrangler types` if adding typed bindings.

Only the generated `dist/` directory is public. Server code, rules, setup documentation and keys are never copied. Static files bypass the Worker; only API and policy/admin routes invoke code. Security headers also apply to static responses. The Google Calendar public connection remains paused during verification.

If the account does not yet have a workers.dev subdomain, open Workers & Pages once or create one before the first preview deployment. Connecting the ChatGPT Cloudflare plugin does not install the Cloudflare GitHub app; authorize the repository in Cloudflare if prompted.

## Domain and OAuth

Keep the domain registration at Namecheap/Gabia and connect DNS to Cloudflare. Add the exact new root URL as a Kakao login redirect URI and the hostname to the Kakao JavaScript domain list before testing. Update Google OAuth JavaScript origins and branding/policy URLs, Search Console ownership, sharing URLs and policy canonical URLs when switching the production domain. Keep the old Vercel site running until validation, then redirect existing poll URLs while preserving `?s=...` and other navigation parameters. Do not discard existing poll IDs or database records.

## Activate secured writes LAST

1. Deploy the new Worker with secrets and test Kakao sign-in and `/api/firebase-token`. Custom Firebase tokens derive their UID only from the signed HttpOnly Kakao session. Tokens use Firebase Auth memory-only persistence.
2. Verify real Firebase auth UIDs match the Kakao ID, with two disposable accounts.
3. Publish **database.secure.rules.json** through Firebase Realtime Database → Rules. Keep the existing deployed rules unchanged until steps 1–2 work. The provided file preserves link-based public meeting reads and private HMAC capability profiles; it requires authentication for metadata writes and restricts member/vote writes to `auth.uid === $mid`. Anonymous/other-user writes must be denied by Firebase, even if a client disables its local auth flag.
4. Validate own sticker add/change/remove/import, own nickname update, live updates across two accounts, rejection of modifying someone else's votes/profile member, meeting title/period editing, creator-only actual deletion, and old-link handling. Physical deletion uses a server-authenticated atomic write without broadening public delete permissions.
5. Switch the domain/redirect and refresh old clients. Old Vercel clients without Firebase authentication cannot write after secured rules activate.

The original `database.rules.json` is preserved for the running legacy site; the secure file is a deliberate, staged replacement, not a second database. After cutover it should become the canonical rules file.

## Verification completed locally

- `node tests/firebase-identity.cjs`: signed-session UID, RSA custom token, expiry, rejected origins/forgeries, memory-only auth, concurrent login, account mismatch and retry. Locally evaluates the own-member/vote rule expressions.
- `node tests/cloudflare-worker.mjs`: request adapter, policy languages, security headers, body size/JSON rejection, no exception details, no server/secret files in public build.
- Existing meeting creation, period editing, unavailable votes and actual deletion tests.

These are Node/VM tests, not Firebase emulator or live Cloudflare tests. Local npm installation is currently blocked by the execution environment proxy, so native Wrangler bundle/schema/types and workerd verification must run in Cloudflare Builds or another network-enabled execution environment. Do not describe this as a verified production migration until those pass and two-account Firebase tests pass.
