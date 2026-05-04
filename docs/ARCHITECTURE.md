# Architecture

Veil has four layers:

1. Vite React wallet app
2. API-owned temporary testnet ledger
3. Arc contracts for VeilHub identity and future VeilShield settlement
4. Future database/indexer infrastructure for production truth

## Frontend

Main app areas:

- `NewPayment`: single payments with explicit mode/source selection.
- `BatchPayments`: form-based recipients, total USDC, validation, and per-recipient progress.
- `UnifiedBalance`: connected-wallet balance reads and deposits through Circle AppKit.
- `Dashboard`, `History`, `PaymentDetailsDrawer`: API ledger views.
- `ConfidentialRecords`, `AccessControl`: VeilShield/Closed Payment records and disclosure workflow.
- `Settings`: workspace preferences.

Shared payment logic lives in `src/lib/payments`:

- `wallet.ts`: account handling and network switching.
- `arcDirect.ts`: VeilHub setup checks, USDC decimals/balance/allowance reads, conditional approval, `payOpen`, `payOpenBatch`, and Unified Balance reference registration.
- `unifiedBalance.ts`: Circle AppKit browser-wallet adapter, deposit, balance read, spend, pending balance handling, and settlement step parsing.
- `recording.ts`: API ledger writes after real transaction or explicit pending reference exists.
- `errors.ts`: wallet rejection, contract revert, insufficient balance, API failure, and delayed settlement formatting.

## Wallet Model

Wallet connection is global. Payment pages use the wallet visible in the app shell and do not ask users to reconnect in the middle of the flow.

## Arc Direct Model

Arc Direct is VeilHub-only. It requires `VITE_USE_VEIL_HUB=true`, `VITE_VEIL_HUB_ADDRESS`, and `VITE_ARC_USDC_ADDRESS`.

Flow:

1. Validate recipient and amount.
2. Switch/request Arc.
3. Read USDC decimals, wallet balance, and VeilHub allowance.
4. Request `approve` only if allowance is too low.
5. Call `VeilHub.payOpen` or `VeilHub.payOpenBatch`.
6. Write the settled payment to the API ledger.

No native-transfer fallback exists.

## Unified Balance Model

Unified Balance user flows stay connected-wallet owned through Circle AppKit. The API does not spend from backend-managed wallets.

If spend succeeds:

- with VeilHub configured: record the API ledger and register `recordUnifiedBalanceOpenPayment`
- without VeilHub configured: record `pending_veilhub_registration`
- with delayed final settlement and balance deducted: record `pending_settlement`
- with no deduction: record no success

## API Ledger

The API JSON ledger is temporary testnet infrastructure. It uses Zod validation, server-side IDs, `createdAt` timestamps, and atomic writes.

Ledger statuses:

- `settled`
- `pending_settlement`
- `pending_veilhub_registration`
- `failed`

Ledger sources:

- `arc_direct`
- `unified_balance`
- `veilshield_closed`, reserved for future closed settlement

Production direction is a database/indexer stack with VeilHub event indexing and VeilShield event indexing when closed payments are live.

## Closed Payment And VeilShield

Closed Payment means sender visible, recipient visible, and amount hidden onchain. The frontend blocks settlement until VeilShield verifier/circuits are deployed and wired.

`VeilShield` is separate from VeilHub because visible ERC20 routing cannot hide amount. It defines deposit, private note commitments, nullifiers, hidden transfer proof hooks, and withdraw proof hooks. It remains experimental/testnet-only until audited.

## API Endpoints

- `GET /api/payments`
- `POST /api/payments`
- `GET /api/dashboard`
- `GET /api/activity`
- `GET /api/confidential-records`
- `POST /api/confidential-records/:id/reveal-request`
- `GET /api/disclosure-access`
- `POST /api/disclosure-access`
- `POST /api/disclosure-access/:id/revoke`
- `GET /api/audit-trail`

Managed bridge and backend-managed Unified Balance endpoints return `410 Gone`.
