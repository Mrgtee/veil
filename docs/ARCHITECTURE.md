# Architecture

Veil has three layers:

1. Frontend wallet app
2. Optional API for non-custodial metadata and operator diagnostics
3. Arc contracts for payment identity and future shielded settlement

## Frontend

The frontend is a Vite React app under `src`.

Main app areas:

- `NewPayment`: single open payments with explicit mode and source selection.
- `BatchPayments`: form-based batch payments with per-recipient progress.
- `UnifiedBalance`: connected-wallet deposits and balance reads.
- `Dashboard`: current app data from recorded payments.
- `History`: searchable payment ledger with pending and failed states.
- `ConfidentialRecords` and `AccessControl`: VeilShield/closed-payment references and disclosure workflow.
- `Settings`: workspace preferences.

Shared payment logic lives in `src/lib/payments`:

- `wallet.ts`: wallet account memory and EVM chain switching.
- `arcDirect.ts`: Arc Direct amount parsing, recipient validation, direct sends, and batch validation.
- `unifiedBalance.ts`: Circle AppKit loading, wallet adapter creation, balance cache, deposit, spend, settlement steps, and balance math.
- `recording.ts`: successful, pending, and failed payment recording.
- `errors.ts`: user-friendly error formatting and delayed settlement detection.
- `types.ts`: payment mode/source labels and options.

## Wallet Model

Wallet connection is global. Users connect once at sign-in, and the connected address appears in the top bar. Payment pages do not ask for duplicate wallet connections.

## Unified Balance Model

User-facing Unified Balance flows use the browser wallet adapter from Circle AppKit. Backend-managed Unified Balance HTTP spend and bridge endpoints are disabled because user-facing spend must not use backend wallets.

Confirmed balance is spendable. Pending balance is shown but not treated as available.

## Payment Recording

Records are stored in browser localStorage in this version:

- `veil.live.payments`
- `veil.live.records`
- `veil.live.access`
- `veil.live.audit`

Successful payments are recorded as `settled`. If Unified Balance appears deducted but Arc settlement confirmation is delayed, Veil records `pending` with a settlement note. If spend fails without deduction, Veil does not record success.

## Contracts

`VeilHub` is the main on-chain identity for open ERC20 USDC payments on Arc. It emits single, batch, and Unified Balance reference events.

`VeilShield` is the experimental hidden-amount layer. It is intentionally separate from visible open payment routing.

## API

The API in `apps/api` still provides health/config and metadata intent endpoints, but user-facing backend-managed bridge and Unified Balance spend endpoints return `410 Gone`.

Operator scripts under `apps/api/src/unified` are testnet diagnostics only and require private keys. They are not used by the frontend payment flow.

