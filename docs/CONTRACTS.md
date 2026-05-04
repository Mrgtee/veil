# Contracts

## VeilHub

File: `contracts/src/VeilHub.sol`

VeilHub is the main on-chain identity for open Veil payments on Arc.
The frontend Arc Direct flow is wired to this contract and does not use the retired native-value vault or batch payout contracts.

Features:

- ERC20 USDC single payment routing.
- ERC20 USDC batch payment routing.
- Unified Balance open payment reference recording.
- `bytes32` `paymentId` and `batchId` uniqueness checks.
- Events for single, batch, and Unified Balance activity.
- SafeERC20 transfer wrappers.
- ReentrancyGuard.
- Pausable.
- Ownable.

Important errors:

- `ZeroAddress`
- `ZeroAmount`
- `ZeroId`
- `AlreadyRecorded`
- `EmptyBatch`
- `LengthMismatch`

## VeilShield

File: `contracts/src/VeilShield.sol`

VeilShield is experimental/testnet-only and is not production-ready. It defines the hidden-amount architecture:

- Deposit USDC into the shield.
- Register private note commitments.
- Spend notes with nullifiers.
- Create recipient note commitments.
- Withdraw using verifier-approved proofs.

The transfer event does not include amount. The verifier interface must be backed by real Noir/ZK circuits before production use.

## Verifier Interface

File: `contracts/src/interfaces/IVeilShieldVerifier.sol`

The verifier exposes:

- `verifyTransferProof`
- `verifyWithdrawProof`

These are placeholders for generated verifier contracts.

## Tests

Foundry tests are in `contracts/test`.

Run:

```bash
cd contracts
forge test
```

The tests cover:

- Invalid recipient.
- Zero amount.
- Empty batch.
- Mismatched arrays.
- Duplicate payment IDs.
- Unified Balance reference recording.
- Shield deposits.
- Duplicate note commitments.
- Invalid proof rejection.
- Nullifier double-spend prevention.
- Withdraw transfers.

## Deployment

Deploy order:

1. USDC token address on Arc.
2. `VeilHub(usdc, owner)`.
3. Test verifier.
4. `VeilShield(usdc, verifier, owner)` on testnet only.
5. Configure frontend addresses.

Do not deploy VeilShield as production-ready until circuits and audits are complete.

Frontend Arc Direct requires:

```bash
VITE_USE_VEIL_HUB=true
VITE_VEIL_HUB_ADDRESS=<deployed VeilHub>
VITE_ARC_USDC_ADDRESS=<Arc USDC ERC20>
```

Unified Balance can spend without VeilHub, but those records stay `pending_veilhub_registration` until a VeilHub reference transaction is submitted.
