# 3-Minute Townhall Demo Script

## 0:00-0:30 - Open Veilarc

"Veilarc is an Arc-based USDC payment workspace. Users connect one wallet globally, then choose payment mode and payment source before sending."

Show the top bar wallet and mobile menu.
Mention that Dashboard and History now read from the API-owned testnet ledger, not browser payment storage.

## 0:30-1:10 - Unified USDC Balance

"Unified USDC Balance shows confirmed and pending USDC for the connected wallet. Confirmed is spendable; pending is visible but not available yet."

Open Unified USDC Balance, choose a source chain, show deposit amount, and explain wallet-signed deposit.

## 1:10-1:55 - New Open Payment

"For a normal payment, choose Open Payment and a source: Arc Direct or Unified USDC Balance."

Enter recipient, amount, optional label/reference, select Open Payment, select source, and point to clear status/result handling. For Arc Direct, call out that it requires VeilHub + Arc USDC env values and routes through ERC20 approval plus `VeilHub.payOpen`. For Unified USDC Balance, call out that it remains usable even if VeilHub registration is pending.

## 1:55-2:30 - Batch Payments and History

"Batch Payments are form-based. Add rows, review total amount, and track progress per recipient."

Open Batch Payments, add a second row, show total, then open History and point out source, mode, status, tx/reference, and pending handling.

## 2:30-3:00 - Private Payment Architecture

"Private Payment means the amount is hidden onchain, not just hidden in the UI. Normal ERC20 transfers cannot do that. Veilarc now shows Coming soon with Arc Private Kit, and it blocks visible transfers from pretending to be private payments."

Open Private Records or Privacy Design docs and end with the roadmap to native Arc privacy integration. Mention VeilShield only as experimental research, not the user-facing private payment path.
