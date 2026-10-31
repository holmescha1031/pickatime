# Permanent meeting deletion

The meeting API verifies the signed Kakao session and the creator-derived meeting ID before deleting anything. It uses a single authenticated, atomic Firebase REST PATCH to erase the session (metadata, members, votes), the administrator index reference, and creator/current-member profile references. Account profiles themselves remain. A private HMAC deletion marker remains to prevent reuse of the deterministic meeting URL. Public Firebase rules must NOT be relaxed to allow session deletion.

## Required production configuration

1. In the **pickatime-meet Firebase project** (not the separate Google Calendar OAuth project), create a dedicated service account in Google Cloud IAM. Grant **Firebase Realtime Database Admin** (`roles/firebasedatabase.admin`) for this project only. Generate its JSON key. An existing suitable Firebase Admin service account may also be used.
2. In Vercel project settings → Environment Variables, add **FIREBASE_SERVICE_ACCOUNT_JSON**, with the entire JSON as its value, scoped to **Production**, marked **Sensitive**. Never use a public/client-prefixed variable, commit this key, or send it in chat.
3. Redeploy and use a disposable poll to verify: creator can delete; other accounts cannot; `sessions/<poll ID>` is absent; open participant tabs show the deleted view; old URL cannot reopen the poll.

Without valid credentials the API returns an error and does not mark or report the poll as deleted. No fallback to the old logical-delete behavior exists. A failed atomic PATCH leaves session data and indexes intact. Retrying after a committed deletion is idempotent.

Existing polls hidden by the earlier deletion system are not swept automatically by this change. They need owner-verified cleanup; do not delete sessions based solely on a client-supplied list. Provider logs/backups and participant browser caches are separate from active database deletion.

## Verification

Run `node tests/meeting-deletion.cjs`. These tests use a fake Firebase transport; production credentials and a disposable real poll are still needed for live verification.
