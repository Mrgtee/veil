# User Flows

## Sign In

1. User opens Veil.
2. User connects an EVM wallet once.
3. Veil stores the connected address locally and opens `/app`.
4. Top bar displays the connected wallet globally.

## New Open Payment With Arc Direct

1. Open `New Payment`.
2. Enter recipient address.
3. Enter USDC amount.
4. Optionally add label/reference.
5. Select `Open Payment`.
6. Select `Arc Direct`.
7. Submit and confirm the wallet request.
8. Veil switches/request Arc Testnet as needed.
9. On success, Veil records a settled payment in History.

## New Open Payment With Unified Balance

1. Open `Unified Balance`.
2. Deposit USDC from a supported source chain if needed.
3. Wait until balance is confirmed.
4. Open `New Payment`.
5. Enter recipient, amount, optional label/reference.
6. Select `Open Payment`.
7. Select `Unified Balance USDC`.
8. Submit and approve the wallet request.
9. If settlement confirms, History records `settled`.
10. If balance is deducted but final Arc confirmation is delayed, History records `pending`.
11. If balance is not deducted, Veil does not record success.

## Batch Open Payment

1. Open `Batch Payments`.
2. Add recipient rows with address and amount.
3. Remove rows if needed.
4. Review recipient count and total amount.
5. Select `Open Payment`.
6. Select `Arc Direct` or `Unified Balance USDC`.
7. Submit.
8. Track progress per recipient.
9. Review the batch record in History.

## Unified Balance Deposit

1. Open `Unified Balance`.
2. Choose Base Sepolia, Ethereum Sepolia, or Arc Testnet as source.
3. Veil requests a wallet network switch.
4. Enter deposit amount.
5. Submit and approve in wallet.
6. Refresh until pending balance becomes confirmed.

## Closed Payment Selection

1. User can select `Closed Payment`.
2. Veil explains that closed means hidden amount onchain.
3. Veil blocks visible transfer settlement until VeilShield is fully deployed and audited.
4. Users are not shown a misleading success state.

## Mobile Navigation

The top-bar menu exposes:

- Dashboard
- New Payment
- Batch Payments
- Unified Balance
- History
- Closed Records
- Access Control
- Settings

