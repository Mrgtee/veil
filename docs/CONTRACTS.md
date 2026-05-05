# Contracts

## VeilHub

File: `contracts/src/VeilHub.sol`

VeilHub is the main on-chain identity for open Veil payments on Arc. The frontend Arc Direct flow is wired to this contract and does not use retired native-transfer, vault, or batch-payout fallbacks.

Features:

- ERC20 USDC single payment routing through `payOpen`
- ERC20 USDC batch payment routing through `payOpenBatch`
- Unified Balance open payment reference recording
- `bytes32` `paymentId` and `batchId` uniqueness checks
- events for single, batch, and Unified Balance activity
- SafeERC20 transfer wrappers
- ReentrancyGuard
- Pausable
- Ownable

Current Arc Testnet deployment:

- Chain ID: `5042002`
- Arc USDC: `0x3600000000000000000000000000000000000000`
- VeilHub: `0x30c77c1C20A5cBB171DE9090789F3dB98aA9734b`

## VeilShield

File: `contracts/src/VeilShield.sol`

VeilShield is experimental/testnet-only and is not production-ready. It defines the future hidden-amount architecture:

- deposit USDC into the shielded pool
- register private note commitments
- require existing input note commitments for shielded transfers
- spend notes with nullifiers
- create recipient output and sender change commitments
- withdraw USDC using verifier-approved proofs
- track `totalShieldedPool` so withdrawals cannot exceed known deposited/unwithdrawn pool accounting

The transfer event does not include amount. Sender, recipient, token, commitments, and nullifier are visible; transfer amount is intended to be proven privately by Noir.

## Verifier Interface

File: `contracts/src/interfaces/IVeilShieldVerifier.sol`

The verifier exposes:

- `verifyTransferProof(proof, nullifierHash, inputNoteCommitment, outputNoteCommitment, changeNoteCommitment, sender, recipient, token)`
- `verifyWithdrawProof(proof, nullifierHash, noteCommitment, owner, token, amount)`

This interface is implemented by `contracts/src/VeilShieldVerifierAdapter.sol`. The adapter maps VeilShield arguments into the public input arrays expected by generated Barretenberg verifiers:

- transfer public inputs: sender, recipient, token, input commitment, output commitment, change commitment, nullifier
- withdraw public inputs: owner, token, note commitment, nullifier, withdrawal amount

Tests use mocks only inside `contracts/test`; there is no production mock verifier.

## Generated Verifiers

Generated verifier files:

- `contracts/src/verifiers/BaseZKHonkVerifier.sol`
- `contracts/src/verifiers/TransferVerifier.sol`
- `contracts/src/verifiers/WithdrawVerifier.sol`

These are generated from Barretenberg output by:

```bash
cd /home/gtee/projects/veil
node scripts/generate-veilshield-verifiers.mjs
```

The raw bb output remains ignored in circuit `target/` folders. The generator extracts the shared verifier base once and gives the transfer and withdraw verifiers stable contract names.

## Noir Circuits

Circuit files:

- `circuits/veil_shield_transfer`
- `circuits/veil_shield_withdraw`
- `circuits/shared`

The transfer circuit proves hidden amount conservation and commitment/nullifier correctness. The withdraw circuit proves a public withdrawal amount matches a hidden note. Withdrawal amount is public because ERC20 USDC exits the shielded pool.

Run:

```bash
cd /home/gtee/projects/veil/circuits/veil_shield_transfer
/home/gtee/.nargo/bin/nargo test

cd /home/gtee/projects/veil/circuits/veil_shield_withdraw
/home/gtee/.nargo/bin/nargo test
```

Generate raw verifier artifacts:

```bash
cd /home/gtee/projects/veil/circuits/veil_shield_transfer
/home/gtee/.nargo/bin/nargo compile
/home/gtee/.bb/bb write_vk -b target/veil_shield_transfer.json -o target/vk -t evm
/home/gtee/.bb/bb write_solidity_verifier -k target/vk/vk -o target/VeilShieldTransferVerifier.sol -t evm
```

Repeat for `veil_shield_withdraw`, then run `node scripts/generate-veilshield-verifiers.mjs` to update committed verifier contracts.

## Tests

Foundry tests are in `contracts/test`.

Run:

```bash
cd /home/gtee/projects/veil/contracts
/home/gtee/.foundry/bin/forge test -vvv
```

The tests cover:

- invalid recipient
- zero amount
- empty batch
- mismatched arrays
- duplicate payment IDs
- Unified Balance reference recording
- Shield deposits
- duplicate note commitments
- unknown input commitment rejection
- invalid proof rejection
- nullifier double-spend prevention
- pause blocking shield actions
- withdraw transfers
- withdraw over pool-accounting rejection
- generated verifier invalid-proof rejection
- adapter public input ordering

## Deployment

Open payments:

1. Arc USDC token address.
2. Deploy or use current `VeilHub(usdc, owner)`.
3. Configure frontend addresses.

Closed payments:

1. Compile and test Noir circuits.
2. Generate transfer and withdraw verifier artifacts.
3. Run `node scripts/generate-veilshield-verifiers.mjs`.
4. Deploy `TransferVerifier` and `WithdrawVerifier` on Arc Testnet.
5. Deploy `VeilShieldVerifierAdapter(transferVerifier, withdrawVerifier)`.
6. Deploy `VeilShield(usdc, verifierAdapter, owner)` on testnet only.
7. Configure `VITE_VEIL_SHIELD_ADDRESS`, `VITE_VEIL_SHIELD_TRANSFER_VERIFIER_ADDRESS`, and `VITE_VEIL_SHIELD_WITHDRAW_VERIFIER_ADDRESS`.
8. Keep UI submit blocked until proof generation, indexing, and audits are complete.

Do not deploy VeilShield as production-ready until circuits, verifier wiring, prover integration, note discovery, indexing, and audits are complete.

Frontend Arc Direct requires:

```bash
VITE_USE_VEIL_HUB=true
VITE_VEIL_HUB_ADDRESS=0x30c77c1C20A5cBB171DE9090789F3dB98aA9734b
VITE_ARC_USDC_ADDRESS=0x3600000000000000000000000000000000000000
```

Unified Balance can spend without VeilHub, but those records stay `pending_veilhub_registration` until a VeilHub reference transaction is submitted.
