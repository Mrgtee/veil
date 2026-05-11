# Durable Storage Plan

Veilarc now supports Supabase/Postgres as the durable API ledger. The JSON ledger remains a local development fallback only.

## Current Production Stack

- Supabase Postgres as the API ledger database.
- Vercel serverless API routes write to Supabase through server-only `SUPABASE_SERVICE_ROLE_KEY`.
- Wallet-scoped payment, disclosure, and audit rows include a normalized `wallet_scope` array.
- The public API shape remains unchanged for the frontend.

## Migration

1. Create a Supabase project.
2. Open the Supabase SQL editor.
3. Paste and run `supabase/migrations/001_veilarc_ledger.sql`.
4. Add these Vercel env vars:
   - `VEIL_LEDGER_BACKEND=supabase`
   - `SUPABASE_URL=https://your-project-ref.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY=<server-only service role key>`
5. Redeploy Vercel.
6. Visit `/api/config`; `ledger.model` should be `supabase-postgres-ledger`.

## Indexing Roadmap

- VeilHub event indexer for Open Payment and Unified USDC Balance references.
- Arc Private Kit event/indexing integration when user-facing Private Payment is available.
- Optional VeilShield research indexing only if that experimental layer remains useful after audits.

## Data Model

Current Supabase tables:

- `veil_payments`: canonical payment payloads, server IDs, timestamps, `external_id`, and indexed `wallet_scope`.
- `veil_confidential_records`: Closed/Private disclosure metadata only; never note secrets.
- `veil_disclosure_access`: disclosure/access records scoped by wallet.
- `veil_audit_events`: API ledger audit payloads scoped by wallet.

The first production schema stores the existing Zod-validated ledger payload in `jsonb` plus normalized wallet scope indexes. Future event-indexer tables can add block number, log index, contract event name, and reconciliation status without changing the frontend API.

## API Compatibility

The frontend keeps using:

- `GET /api/payments?wallet=0x...`
- `GET /api/dashboard?wallet=0x...`
- `GET /api/activity?wallet=0x...`
- `GET /api/confidential-records?wallet=0x...`
- `GET /api/audit?wallet=0x...`

The API validates the same Zod schemas before writing to Supabase.

## VeilHub Indexing

The indexer should read Arc Testnet events from `VeilHub` and reconcile them with API writes:

- `payOpen` events become settled Arc Direct payment records.
- `payOpenBatch` events become batch records plus recipient rows.
- Unified USDC Balance references update pending records once registered.
- Duplicate event processing must be idempotent by tx hash, log index, payment id, and batch id.

## Safety Requirements

- Never store private note secrets, private salts, or private proof witnesses.
- Do not trust frontend status alone; settled records need a real tx hash or indexed contract event.
- Preserve pending states when API writes succeed but indexer confirmation is delayed.
- Keep failed wallet rejections out of successful payment history.
- Make every dashboard/history query wallet-scoped by default.

## JSON Fallback Limitation

If Supabase is not configured and the backend is left as `json`, Vercel serverless uses `/tmp/veil-ledger.json`. That can reset across deployments or platform lifecycle events. Treat it as smoke-test state only. If `VEIL_LEDGER_BACKEND=supabase` is set without `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, API writes will fail fast instead of silently using temporary storage.
