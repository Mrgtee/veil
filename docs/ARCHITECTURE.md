# Architecture

Veil has four layers:

1. Vite React wallet app
2. API-owned temporary testnet ledger
3. Arc contracts for VeilHub identity and experimental privacy research
4. Future database/indexer infrastructure for production truth

## Frontend

Main app areas:

- `NewPayment`: single payments with explicit mode/source selection.
- `BatchPayments`: form-based recipients, total USDC, validation, and per-recipient progress.
- `UnifiedBalance`: connected-wallet balance reads and deposits through Circle AppKit.
- `Dashboard`, `History`, `PaymentDetailsDrawer`: API ledger views.
- `ConfidentialRecords`, `AccessControl`: future Arc Private Kit records and disclosure workflow.
- `Settings`: workspace preferences.

Shared payment logic lives in `src/lib/payments`:

- `wallet.ts`: account handling and network switching.
- `arcDirect.ts`: VeilHub setup checks, USDC decimals/balance/allowance reads, conditional approval, `payOpen`, `payOpenBatch`, and Unified USDC Balance reference registration.
- `unifiedBalance.ts`: Circle AppKit browser-wallet adapter, deposit, balance read, spend, pending balance handling, and settlement step parsing.
- `recording.ts`: API ledger writes after real transaction or explicit pending reference exists.
- `errors.ts`: wallet rejection, contract revert, insufficient balance, API failure, and delayed settlement formatting.
- `veilShield.ts`: experimental testnet-only research helper. It is not used by the normal Private Payment UI and never enables visible-transfer settlement as closed.
- `veilShieldNotes.ts`: local encrypted developer-preview note storage and Noir helper command construction. Note secrets never go to the API ledger.

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

## Unified USDC Balance Model

Unified USDC Balance user flows stay connected-wallet owned through Circle AppKit. The API does not spend from backend-managed wallets.

If spend succeeds:

- with VeilHub configured: record the API ledger and register `recordUnifiedBalanceOpenPayment`
- without VeilHub configured: record `pending_veilhub_registration`
- with delayed final settlement and balance deducted: record `pending_settlement`
- with no deduction: record no success

### Unified USDC Balance Batch Reality

Arc Direct batch and Unified USDC Balance batch are intentionally different today.

- Arc Direct batch is a true one-transaction batch: one USDC approval if needed, then one `VeilHub.payOpenBatch` transaction that pays all recipients.
- Unified USDC Balance batch is sequential: one Circle AppKit `spend` call per recipient, each with its own wallet approval/spend and settlement result.

This is not a UX preference; it follows the current SDK surface in the installed packages. `@circle-fin/app-kit@1.4.1` depends on `@circle-fin/unified-balance-kit@1.0.1`; the Unified USDC Balance `spend` params expose a single destination object with optional `recipientAddress`. The kit supports multi-source allocation, meaning one spend can draw USDC from multiple source chains/accounts, but it does not expose a native multi-recipient destination array in this integration.

The frontend therefore labels this path as `Sequential Unified USDC`, shows recipient X of N, and records per-recipient settled, pending settlement, pending VeilHub registration, or failed state.

### Future Unified USDC Balance Escrow Batch

A future true Unified USDC Balance batch should not fake batching in the browser. The safer architecture is:

1. User creates a batch intent with recipients, amounts, total USDC, token, deadline, and `batchId`.
2. User spends the total Unified USDC Balance amount to a VeilHub escrow address or a dedicated audited escrow contract.
3. After final Arc settlement is confirmed, VeilHub verifies the batch intent and distributes exact USDC amounts to recipients in one contract transaction.
4. The API/indexer records the spend, escrow receipt, distribution transaction, and any pending state.

Safety requirements before implementing escrow:

- Exact total received must match the batch total before distribution.
- `batchId` must be single-use and idempotent.
- Funds need a tested refund path if distribution cannot execute before deadline.
- Distribution must use SafeERC20, ReentrancyGuard, Pausable controls, and strict recipient/amount array validation.
- Partial distribution must be avoided or explicitly modeled with recoverable state.
- Tests must cover mismatched totals, invalid recipients, zero amounts, expired batches, duplicate batch IDs, failed transfers, pause/refund behavior, and ledger/indexer reconciliation.

Veil should not implement this escrow path until the contract design and tests are complete.

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
- `veilshield_closed`, used only for experimental research records from the VeilShield prototype

Ledger operations:

- `payment`
- `shield_deposit`
- `shield_transfer`
- `shield_withdraw`

Production direction is a database/indexer stack with VeilHub event indexing and Arc Private Kit event/indexing integration when user-facing private payments are live.

## Private Payment Positioning

Private Payment means sender visible, recipient visible, and amount hidden onchain. The frontend now shows `Coming soon with Arc Private Kit` and blocks private settlement until native Arc privacy integration is available, wired, tested, and audited.

Visible Arc Direct or Unified USDC Balance transfers are not accepted as Private Payment settlement. No UI should imply that hiding labels, memos, or records hides the onchain amount.

## Experimental VeilShield Research

`VeilShield` is separate from VeilHub because visible ERC20 routing cannot hide amount. It defines deposit, private note commitments, nullifiers, hidden transfer proof hooks, withdraw proof hooks, and pool accounting. It remains experimental/testnet-only until audited.

### Milestone 2 Circuit Prototype

The new circuit workspace lives under `circuits/`:

- `shared`: Pedersen-based commitment and nullifier helpers
- `veil_shield_transfer`: proves hidden transfer amount conservation and creates output/change commitments
- `veil_shield_withdraw`: proves a public withdrawal amount matches a hidden note
- `veil_shield_note`: developer helper for calculating note commitment/nullifier values with Noir
- `veil_shield_transfer_inputs`: developer helper for calculating transfer public inputs with Noir

Transfer public inputs are sender, recipient, token, input commitment, output commitment, change commitment, and nullifier. Transfer amounts remain private. Withdraw amount is public because public USDC leaves the shielded pool.

Generated Solidity verifiers are committed under `contracts/src/verifiers/`, with shared Barretenberg code split into `BaseZKHonkVerifier.sol` and stable `TransferVerifier` / `WithdrawVerifier` contracts. `VeilShieldVerifierAdapter` maps VeilShield arguments into the public input arrays expected by those generated verifiers.

The local developer CLI can generate proof artifacts and submit `transferNote` or `withdraw` to VeilShield. Transfer artifacts separate public fields from `localPrivate` amount and secret fields; the API ledger can record hidden-transfer research records without storing the transfer amount. The browser does not expose VeilShield deposits, transfers, or withdrawals as the normal Private Payment flow.

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

Managed bridge and backend-managed Unified USDC Balance endpoints return `410 Gone`.
