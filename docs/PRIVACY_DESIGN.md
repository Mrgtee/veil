# Privacy Design

## Normal ERC20 Transfers Do Not Hide Amounts

An ERC20 transfer emits public `Transfer(from, to, amount)` data. Anyone can read the sender, recipient, token, and amount from logs and state changes. A native-value transfer similarly exposes value in the transaction. Hiding a memo, label, invoice reference, or UI text does not hide the payment amount onchain.

For that reason, Veil does not call a visible transfer a Closed Payment.

## Closed Payment Definition

Closed Payment means:

- sender remains visible
- recipient remains visible
- amount is hidden onchain during the private transfer

This is different from anonymous payments. Veil's target privacy model is amount confidentiality with visible counterparties.

## VeilShield Model

VeilShield uses a shielded accounting model:

1. Deposit: a user deposits public USDC into VeilShield and creates a private note commitment.
2. Private note: the note represents value without exposing the amount in future transfer events.
3. Hidden transfer: the sender spends a note by publishing a nullifier and a proof, then creates recipient and change note commitments.
4. Withdraw: a note owner can withdraw public USDC later. Withdrawal reveals the withdrawn amount because public ERC20 USDC exits the shielded pool.

## Milestone 2 Noir Prototype

The repo now includes a first testnet-only Noir prototype:

- `circuits/veil_shield_transfer`
- `circuits/veil_shield_withdraw`
- `circuits/veil_shield_note`
- `circuits/veil_shield_transfer_inputs`
- `circuits/shared`

The prototype uses Noir's built-in `std::hash::pedersen_hash` for commitments and nullifiers so the circuits can be tested locally without extra dependencies. Production may switch to Poseidon/Poseidon2 after verifier compatibility, proof costs, and audit assumptions are locked.

### Transfer Circuit

Private inputs:

- `input_amount`
- `transfer_amount`
- `change_amount`
- `secret`
- `input_salt`
- `output_salt`
- `change_salt`

Public inputs:

- `sender`
- `recipient`
- `token`
- `input_commitment`
- `output_commitment`
- `change_commitment`
- `nullifier_hash`

The circuit proves:

- `transfer_amount > 0`
- `input_amount = transfer_amount + change_amount`
- `input_commitment` matches `sender`, `token`, hidden amount, secret, and input salt
- `output_commitment` matches `recipient`, `token`, hidden transfer amount, and output salt
- `change_commitment` matches `sender`, `token`, hidden change amount, secret, and change salt
- `nullifier_hash` matches the input secret and salt

The amount is never public in the hidden transfer circuit. Sender, recipient, token, commitments, and nullifier are public.

Important developer-preview limitation: the current transfer output commitment is a prototype public commitment for recipient, token, hidden transfer amount, and output salt. Production note handoff still needs a recipient-owned secret/encryption model so recipients can discover, decrypt, prove ownership of, and spend received notes safely. Until that is wired and tested, the browser does not submit `transferNote`.

### Withdraw Circuit

Private inputs:

- `amount`
- `secret`
- `salt`

Public inputs:

- `owner`
- `token`
- `commitment`
- `nullifier_hash`
- `withdraw_amount`

The circuit proves:

- `withdraw_amount == amount`
- `commitment` matches owner, token, hidden amount, secret, and salt
- `nullifier_hash` matches secret and salt

Withdrawal amount is public by design because a public USDC transfer out of the shielded pool reveals the amount.

## Solidity State Rules

`contracts/src/VeilShield.sol` remains experimental/testnet-only. It now supports:

- USDC deposit into a shielded pool
- note commitment registration
- explicit `totalShieldedPool` accounting
- nullifier reuse prevention
- transfer verifier hooks with input, output, and change commitments
- withdraw verifier hooks with note commitment, owner, token, and amount
- pause controls
- tests for zero deposit, duplicate commitments, unknown input commitments, nullifier reuse, invalid proofs, pause, and pool over-withdraw prevention

Verifier logic is behind `IVeilShieldVerifier` and the production adapter at `contracts/src/VeilShieldVerifierAdapter.sol`. Generated Barretenberg verifiers live in `contracts/src/verifiers/`. Tests use mocks only inside `contracts/test`; there is no production mock verifier.

## Note Storage Preview

The app now supports local testnet note storage for VeilShield deposits:

- note commitment is public and can be stored in the API ledger after a real deposit transaction
- amount, secret, salt, and optional nullifier are encrypted locally in the browser
- note secrets are never sent to the API ledger
- losing browser storage can make a testnet note unrecoverable
- this local encryption is a developer preview, not a production key-management system

Deposit flow is real: the connected wallet approves VeilShield if needed and calls `VeilShield.deposit(amount, noteCommitment, encryptedNoteRef)`. Hidden transfers and withdrawals remain blocked in the browser until real proof generation and note handoff are wired.

## What Remains Before Closed Payment Can Go Live

- Wire browser proof generation or a safe local prover bridge for real witnesses.
- Add a recipient note discovery and handoff model so recipients can find and spend their output notes.
- Add a Merkle tree or accumulator for scalable note membership.
- Index VeilShield events for closed-payment records.
- Replace the JSON ledger with production database/indexer infrastructure before mainnet.
- Complete a formal threat model and external security audit.

## Tooling

Install Noir/Nargo and Barretenberg:

```bash
cd /home/gtee/projects/veil
curl -L https://raw.githubusercontent.com/noir-lang/noirup/refs/heads/main/install | bash
source ~/.bashrc
noirup
curl -L https://raw.githubusercontent.com/AztecProtocol/aztec-packages/refs/heads/master/barretenberg/bbup/install | bash
source ~/.bashrc
bbup
nargo --version
bb --version
```

Run circuit tests:

```bash
cd /home/gtee/projects/veil/circuits/veil_shield_transfer
/home/gtee/.nargo/bin/nargo test

cd /home/gtee/projects/veil/circuits/veil_shield_withdraw
/home/gtee/.nargo/bin/nargo test

cd /home/gtee/projects/veil/circuits/veil_shield_note
/home/gtee/.nargo/bin/nargo test

cd /home/gtee/projects/veil/circuits/veil_shield_transfer_inputs
/home/gtee/.nargo/bin/nargo test
```

Compile and generate verifier artifacts:

```bash
cd /home/gtee/projects/veil/circuits/veil_shield_transfer
/home/gtee/.nargo/bin/nargo compile
/home/gtee/.bb/bb gates -b target/veil_shield_transfer.json -t evm
/home/gtee/.bb/bb write_vk -b target/veil_shield_transfer.json -o target/vk -t evm
/home/gtee/.bb/bb write_solidity_verifier -k target/vk/vk -o target/VeilShieldTransferVerifier.sol -t evm

cd /home/gtee/projects/veil/circuits/veil_shield_withdraw
/home/gtee/.nargo/bin/nargo compile
/home/gtee/.bb/bb gates -b target/veil_shield_withdraw.json -t evm
/home/gtee/.bb/bb write_vk -b target/veil_shield_withdraw.json -o target/vk -t evm
/home/gtee/.bb/bb write_solidity_verifier -k target/vk/vk -o target/VeilShieldWithdrawVerifier.sol -t evm
```

Regenerate committed verifier contracts after circuit changes:

```bash
cd /home/gtee/projects/veil
node scripts/generate-veilshield-verifiers.mjs
```

The generator splits bb output into a shared `BaseZKHonkVerifier.sol` plus cleanly named `TransferVerifier.sol` and `WithdrawVerifier.sol`. Do not edit generated Solidity by hand.

Generate developer-preview note commitments and proof artifacts:

```bash
cd /home/gtee/projects/veil
node scripts/veilshield-dev-proof.mjs note --owner <wallet> --token 0x3600000000000000000000000000000000000000 --amount-base <usdc-base-units>
node scripts/veilshield-dev-proof.mjs transfer --sender <wallet> --recipient <recipient> --token 0x3600000000000000000000000000000000000000 --input-amount-base <input> --transfer-amount-base <transfer> --secret <secret> --input-salt <salt> --output-salt <salt> --change-salt <salt>
node scripts/veilshield-dev-proof.mjs withdraw --owner <wallet> --token 0x3600000000000000000000000000000000000000 --amount-base <amount> --secret <secret> --salt <salt>
```

These commands use real Noir/BB execution. They are not browser proof generation and do not make Closed Payment user-facing yet.

## Security Requirements

VeilShield must remain experimental and testnet-only until audited. The prototype proves local circuit correctness only; it is not a production confidential payment system. No UI should imply that a normal visible Arc transfer hides the amount.
