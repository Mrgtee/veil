# VeilShield Noir Prototype

This folder contains the first testnet-only Noir prototype for VeilShield hidden-amount payments. These circuits are not production-ready and are not yet wired to a deployed verifier.

## Circuits

- `veil_shield_transfer`: proves a hidden transfer amount is positive, balances with change, and matches public commitments/nullifier without exposing the amount.
- `veil_shield_withdraw`: proves a withdrawal amount matches a hidden note. The withdrawal amount is public because public USDC exits the shielded pool.
- `veil_shield_note`: developer helper that returns the note commitment and nullifier for a deposit/withdraw note.
- `veil_shield_transfer_inputs`: developer helper that returns the public commitments/nullifier needed by the transfer circuit.
- `shared`: helper commitment/nullifier functions used by both circuits.

The prototype uses Noir's built-in Pedersen hash so the local circuit can be tested with no extra dependencies. Production may switch to Poseidon/Poseidon2 after the verifier, hash assumptions, and audit plan are locked.

## Run Tests

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

## Compile And Generate Verifier Artifacts

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

After generating raw bb artifacts, update the committed Solidity verifier contracts:

```bash
cd /home/gtee/projects/veil
node scripts/generate-veilshield-verifiers.mjs
```

This writes:

- `contracts/src/verifiers/BaseZKHonkVerifier.sol`
- `contracts/src/verifiers/TransferVerifier.sol`
- `contracts/src/verifiers/WithdrawVerifier.sol`

Do not edit those generated Solidity files by hand.

## Developer Proof Helper

Use the committed helper script to calculate note commitments/nullifiers and produce local proof artifacts:

```bash
cd /home/gtee/projects/veil
node scripts/veilshield-dev-proof.mjs note --owner <wallet> --token 0x3600000000000000000000000000000000000000 --amount-base <usdc-base-units>
node scripts/veilshield-dev-proof.mjs transfer --sender <wallet> --recipient <recipient> --token 0x3600000000000000000000000000000000000000 --input-amount-base <input> --transfer-amount-base <transfer> --secret <secret> --input-salt <salt> --output-salt <salt> --change-salt <salt>
node scripts/veilshield-dev-proof.mjs withdraw --owner <wallet> --token 0x3600000000000000000000000000000000000000 --amount-base <amount> --secret <secret> --salt <salt>
```

The helper writes ignored `Prover.toml` and `target/` files. It is developer-preview tooling, not browser proof generation.
