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

## New Open Payment With Unified USDC Balance

1. User opens `Unified USDC Balance`.
2. User deposits USDC from a supported source chain if needed.
3. User waits until balance is confirmed.
4. User opens `New Payment`.
5. User enters recipient, amount, optional label, and optional reference.
6. User selects `Open Payment`.
7. User selects `Unified USDC Balance`.
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
5. User selects `Arc Direct` or `Unified USDC Balance`.
6. Arc Direct is the recommended true batch path: it requires VeilHub env setup, requests one USDC approval if needed, and calls `VeilHub.payOpenBatch` once for the full recipient list.
7. Unified USDC Balance is labeled as `Sequential Unified USDC`: the current Circle AppKit integration spends to one recipient per call, so Veil requests one wallet approval/spend per recipient.
8. During sequential Unified USDC Balance payouts, Veil shows recipient X of N, awaiting wallet approval, pending settlement, settled, pending VeilHub registration, or failed state for each row.
9. User reviews per-recipient progress and the API ledger record in History. Unified USDC Balance batch records must not be treated as proof that one transaction paid every recipient.

## Batch Source Guidance

- `Arc Direct`: use this when the goal is one onchain batch transaction through VeilHub. It is the current recommended batch option.
- `Unified USDC Balance`: use this when the user wants to spend confirmed Unified USDC Balance funds and accepts a sequential payout flow. It is not currently a native multi-recipient spend.

Current SDK investigation:

- The installed `@circle-fin/app-kit@1.4.1` uses `@circle-fin/unified-balance-kit@1.0.1`.
- The Unified USDC Balance `spend` API exposes one destination object with optional `recipientAddress`.
- The SDK supports multi-source allocations into one spend, but this is different from sending one spend to multiple recipients.
- Veil therefore keeps Unified USDC Balance batch honest as a sequential workflow until Circle AppKit exposes a native multi-recipient destination or Veil ships a tested escrow distribution contract.

## Unified USDC Balance Deposit

1. User opens `Unified USDC Balance`.
2. User chooses Base Sepolia, Ethereum Sepolia, or Arc Testnet as source.
3. Veil requests a wallet network switch.
4. User enters deposit amount.
5. User approves the deposit through Circle AppKit.
6. Veil refreshes confirmed and pending balances from the connected wallet.

## Private Payment Selection

1. User can select `Private Payment`.
2. Veil shows `Coming soon with Arc Private Kit.`
3. Veil explains that it is preparing native Arc privacy integration for hidden/private payment support.
4. Veil explains that true private settlement cannot be a visible ERC20 transfer because normal transfers expose amount.
5. Veil blocks submit until Arc Private Kit integration is available, wired, tested, and audited.

## Experimental Research / Developer Preview

VeilShield is no longer the normal user-facing Private Payment flow. It remains documented research tooling only:

1. Developers can generate Noir note, transfer, and withdraw artifacts locally.
2. Developers can submit real proof artifacts to the deployed Arc Testnet VeilShield contracts from a local shell.
3. The submit script validates artifacts, checks note/nullifier state, simulates the contract call, sends the transaction, waits for the receipt, and records `shield_transfer` only after a real tx hash exists.
4. Normal browser users cannot submit VeilShield deposits, transfers, or withdrawals from the Private Payment UI.

## Private Records And Access

1. `Private Records` is reserved for future Arc Private Kit records and disclosure state.
2. `Access Control` grants or revokes disclosure permissions for private records when they exist.
3. These pages do not imply hidden/private settlement is live.

## Mobile Navigation

Mobile users can access:

- Dashboard
- New Payment
- Batch Payments
- Unified USDC Balance
- History
- Private Records
- Access Control
- Settings
