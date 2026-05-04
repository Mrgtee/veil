# Privacy Design

## Normal ERC20 Transfers Do Not Hide Amounts

An ERC20 transfer emits public `Transfer(from, to, amount)` data. Anyone can read the sender, recipient, token, and amount from logs and state changes. A native-value transfer similarly exposes value in the transaction. Hiding a memo, label, invoice reference, or UI text does not hide the payment amount onchain.

For that reason, Veil does not call a visible transfer a Closed Payment.

## Closed Payment Definition

Closed Payment means:

- Sender remains visible.
- Recipient remains visible.
- Amount is hidden onchain during the private transfer.

This is different from anonymous payments. Veil's target privacy model is amount confidentiality with visible counterparties.

## VeilShield Model

VeilShield uses a shielded accounting model:

1. Deposit: user deposits USDC into VeilShield and creates a private note commitment.
2. Private balance: the note represents value without exposing the amount in future transfers.
3. Hidden transfer: sender spends a note by publishing a nullifier and proof, and creates a new note for the recipient.
4. Withdraw: recipient can withdraw later. Withdrawals may reveal the withdrawn amount, but the prior shielded transfer amount is not emitted by the transfer event.

## Nullifiers

A nullifier prevents double-spending. Once a private note is spent, its nullifier hash is marked as used. Any second attempt with the same nullifier reverts.

The included `VeilShield.sol` implements nullifier storage and double-spend checks, but the actual proof logic is delegated to a verifier interface.

## Why ZK Is Required

Without a zero-knowledge proof, a contract cannot know that a hidden note is valid, unspent, and value-conserving without seeing the amount. A ZK circuit proves:

- The sender owns a valid note.
- The nullifier corresponds to that note.
- The output note is well formed.
- Value is conserved.
- The hidden amount is not leaked.

## What Is Implemented Now

- `VeilShield.sol` testnet-only skeleton.
- Deposit with note commitment registration.
- Hidden transfer event shape that excludes amount.
- Nullifier double-spend checks.
- Withdraw proof hook and token transfer.
- `IVeilShieldVerifier` interface.
- Tests for deposits, duplicate commitments, invalid proof, withdraw, and nullifier reuse.
- Frontend Closed Payment selection that blocks visible settlement instead of simulating privacy.
- API ledger support for future `veilshield_closed` records.

## What Remains

- Noir circuits for note creation, transfer, and withdraw.
- Public input design for sender-visible and recipient-visible transfers.
- Merkle tree or accumulator for note membership.
- Proof generation in the frontend.
- Verifier contract deployment.
- Event indexing and recipient note discovery.
- Production database/indexer storage for closed records.
- Formal threat model.
- External security audit.

## Security Requirements

VeilShield must remain experimental and testnet-only until audited. The skeleton is not production cryptography, and no UI should imply that a normal visible Arc transfer hides the amount.
