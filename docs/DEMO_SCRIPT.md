# 3-Minute Townhall Demo Script

## 0:00-0:30 - Open Veil

"Veil is an Arc-based USDC payment workspace. Users connect one wallet globally, then choose payment mode and payment source before sending."

Show the top bar wallet and mobile menu.

## 0:30-1:10 - Unified Balance

"Unified Balance shows confirmed and pending USDC for the connected wallet. Confirmed is spendable; pending is visible but not available yet."

Open Unified Balance, choose a source chain, show deposit amount, and explain wallet-signed deposit.

## 1:10-1:55 - New Open Payment

"For a normal payment, choose Open Payment and a source: Arc Direct or Unified Balance USDC."

Enter recipient, amount, optional label/reference, select Open Payment, select source, and point to clear status/result handling.

## 1:55-2:30 - Batch Payments and History

"Batch Payments are form-based. Add rows, review total amount, and track progress per recipient."

Open Batch Payments, add a second row, show total, then open History and point out source, mode, status, tx/reference, and pending handling.

## 2:30-3:00 - Closed Payment Architecture

"Closed Payment means the amount is hidden onchain, not just hidden in the UI. Normal ERC20 transfers cannot do that. VeilShield is the experimental deposit-note-nullifier-ZK architecture. Until it is deployed and audited, Veil blocks visible transfers from pretending to be closed payments."

Open Closed Records or Privacy Design docs and end with the roadmap to full Noir/ZK settlement.

