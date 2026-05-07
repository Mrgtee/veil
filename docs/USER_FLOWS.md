# User Flows

## Sign In

1. User opens Veil.
2. User connects an EVM wallet once.
3. Veil remembers the session locally and opens `/app`.
4. The top bar displays the connected wallet globally.

## New Open Payment With Arc Direct

1. User opens `New Payment`.
2. User enters recipient, amount, optional label, and optional reference.
3. User selects `Open Payment`.
4. User selects `Arc Direct`.
5. If `VITE_USE_VEIL_HUB`, `VITE_VEIL_HUB_ADDRESS`, or `VITE_ARC_USDC_ADDRESS` is missing, Veil disables submit and shows setup-required details.
6. Veil switches/request Arc, reads USDC decimals, balance, and allowance.
7. If allowance is too low, Veil asks the wallet to approve VeilHub.
8. Veil calls `VeilHub.payOpen`.
9. On transaction success, Veil writes a settled API ledger record.
10. If the transaction submits but the API write fails, Veil shows the transaction hash and the ledger-write failure.

## New Open Payment With Unified Balance

1. User opens `Unified Balance`.
2. User deposits USDC from a supported source chain if needed.
3. User waits until balance is confirmed.
4. User opens `New Payment`.
5. User enters recipient, amount, optional label, and optional reference.
6. User selects `Open Payment`.
7. User selects `Unified Balance USDC`.
8. Veil spends through Circle AppKit with the connected wallet.
9. If spend succeeds and VeilHub is configured, Veil registers a VeilHub reference and records `settled`.
10. If spend succeeds and VeilHub is not configured or registration fails, Veil records `pending_veilhub_registration`.
11. If balance is deducted but final Arc settlement is delayed, Veil records `pending_settlement`.
12. If balance is not deducted, Veil does not record success.

## Batch Open Payment

1. User opens `Batch Payments`.
2. User adds recipient rows with address, amount, optional label, and optional reference.
3. User reviews recipient count and total USDC.
4. User selects `Open Payment`.
5. User selects `Arc Direct` or `Unified Balance USDC`.
6. Arc Direct is the recommended true batch path: it requires VeilHub env setup, requests one USDC approval if needed, and calls `VeilHub.payOpenBatch` once for the full recipient list.
7. Unified Balance is labeled as `Sequential Unified Balance batch`: the current Circle AppKit integration spends to one recipient per call, so Veil requests one wallet approval/spend per recipient.
8. During sequential Unified Balance payouts, Veil shows recipient X of N, awaiting wallet approval, pending settlement, settled, pending VeilHub registration, or failed state for each row.
9. User reviews per-recipient progress and the API ledger record in History. Unified Balance batch records must not be treated as proof that one transaction paid every recipient.

## Batch Source Guidance

- `Arc Direct`: use this when the goal is one onchain batch transaction through VeilHub. It is the current recommended batch option.
- `Unified Balance USDC`: use this when the user wants to spend confirmed Unified Balance funds and accepts a sequential payout flow. It is not currently a native multi-recipient spend.

Current SDK investigation:

- The installed `@circle-fin/app-kit@1.4.1` uses `@circle-fin/unified-balance-kit@1.0.1`.
- The Unified Balance `spend` API exposes one destination object with optional `recipientAddress`.
- The SDK supports multi-source allocations into one spend, but this is different from sending one spend to multiple recipients.
- Veil therefore keeps Unified Balance batch honest as a sequential workflow until Circle AppKit exposes a native multi-recipient destination or Veil ships a tested escrow distribution contract.

## Unified Balance Deposit

1. User opens `Unified Balance`.
2. User chooses Base Sepolia, Ethereum Sepolia, or Arc Testnet as source.
3. Veil requests a wallet network switch.
4. User enters deposit amount.
5. User approves the deposit through Circle AppKit.
6. Veil refreshes confirmed and pending balances from the connected wallet.

## Closed Payment Selection

1. User can select `Closed Payment`.
2. Veil explains that closed means sender-visible, recipient-visible, amount-hidden settlement.
3. Veil blocks visible ERC20 settlement because normal transfers expose amount.
4. Veil shows Milestone 2 setup state: VeilShield and generated verifiers are deployed, local note storage exists, and proof generation is still pending.
5. Developer-preview users can prepare a local note secret/salt, run the Noir helper command, paste the returned commitment, and deposit USDC into VeilShield.
6. Veil records successful real deposit transactions in the API ledger as `shield_deposit` only after a tx hash exists.
7. Hidden transfer submission remains disabled in the browser until browser proof generation, recipient note handoff, indexing, and audit are complete.

## VeilShield Developer Preview Deposit

1. User selects `Closed Payment` in `New Payment`.
2. User clicks `Prepare note`; the browser creates local testnet note secret/salt values and an encrypted note reference.
3. User runs the displayed `node scripts/veilshield-dev-proof.mjs note ...` command locally with Noir/Nargo installed.
4. User pastes the returned commitment and optional nullifier into the app.
5. Veil switches to Arc if needed, checks USDC balance and allowance, requests `approve` only if needed, and calls `VeilShield.deposit`.
6. Veil stores amount, secret, salt, and nullifier encrypted in this browser only.
7. Veil writes the API ledger record as `source=veilshield_closed`, `operation=shield_deposit`, `status=settled`.
8. The note appears in local shielded note balance, but it is still a developer-preview note until proof submit/withdraw flows are wired.

## VeilShield Developer Preview Proof Submission

1. Developer exports or reads the local note secret/salt from their own testnet preview context.
2. Developer runs `node scripts/veilshield-dev-proof.mjs transfer ... --artifact-out /tmp/veil-transfer-artifact.json`.
3. The helper writes a JSON artifact with proof bytes, ordered public inputs, contract-call fields, and local-private amount/secret fields separated.
4. Developer sources `contracts/.env` with `PRIVATE_KEY`, `ARC_TESTNET_RPC_URL`, `VEIL_SHIELD_ADDRESS`, and `ARC_USDC_ADDRESS`.
5. Developer runs `node scripts/veilshield-submit-proof.mjs transfer --artifact /tmp/veil-transfer-artifact.json --record-ledger`.
6. The submit script validates the artifact, verifies the private key matches the proof sender, checks VeilShield note/nullifier state, simulates `transferNote`, sends the transaction, waits for the receipt, and records `shield_transfer` only after a real tx hash exists.
7. Withdraw artifacts use the same pattern with `node scripts/veilshield-dev-proof.mjs withdraw ...` and `node scripts/veilshield-submit-proof.mjs withdraw ...`.
8. Normal browser users still cannot submit Closed Payment transfers.

## Closed Records And Access

1. `Closed Records` lists VeilShield commitment/disclosure records from the API ledger.
2. `Access Control` grants or revokes disclosure permissions for those records.
3. These pages do not imply hidden-amount settlement is live.

## Mobile Navigation

Mobile users can access:

- Dashboard
- New Payment
- Batch Payments
- Unified Balance
- History
- Closed Records
- Access Control
- Settings
