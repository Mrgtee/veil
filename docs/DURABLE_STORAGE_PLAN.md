# Durable Storage Plan

Veilarc's current JSON ledger is temporary preview/testnet infrastructure. It is useful for local development and Vercel smoke tests, but it is not durable enough for production payment history.

## Target Stack

- Supabase Postgres or managed Postgres as the API ledger database.
- Wallet-scoped payment, batch, activity, disclosure, and audit tables.
- VeilHub event indexer for Open Payment and Unified USDC Balance references.
- Arc Private Kit event/indexing integration when user-facing Private Payment is available.
- Optional VeilShield research indexing only if that experimental layer remains useful after audits.

## Data Model

Core tables:

- `payments`: id, type, mode, source, operation, status, sender, owner, payer, wallet_address, recipient, recipients, amount, token, tx_hash, payment_id, batch_id, created_at.
- `payment_events`: immutable status transitions, wallet actor, tx hash, block number, source system, created_at.
- `batches`: batch id, sender, total amount, recipient count, status, tx hash, created_at.
- `ledger_audit`: API write actor, target id, action, created_at.
- `private_records`: future Arc Private Kit disclosure metadata only; never note secrets.

All wallet address comparisons should be case-insensitive and backed by normalized lowercase columns.

## API Migration Path

1. Keep the current JSON ledger shape as the external API contract.
2. Add a repository interface behind the API routes.
3. Implement a Postgres repository with Zod validation at the API boundary.
4. Add a one-time JSON import script for testnet preview records.
5. Switch `VITE_API_BASE_URL` to the hosted durable API.
6. Keep wallet-scoped endpoint behavior:
   - `GET /api/payments?wallet=0x...`
   - `GET /api/dashboard?wallet=0x...`
   - `GET /api/activity?wallet=0x...`
   - `GET /api/confidential-records?wallet=0x...`
   - `GET /api/audit?wallet=0x...`

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

## Vercel Preview Limitation

The Vercel serverless JSON ledger currently uses `/tmp/veil-ledger.json`. That can reset across deployments or platform lifecycle events. Treat it as smoke-test state only.
