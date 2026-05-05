# Veil Contracts

Contracts in this package define Veil's Arc on-chain identity.

- `src/VeilHub.sol`: ERC20 USDC open payment router and Unified Balance reference recorder.
- `src/VeilShield.sol`: experimental/testnet-only hidden-amount architecture.
- `src/interfaces/IVeilShieldVerifier.sol`: verifier interface shaped for the Milestone 2 Noir transfer/withdraw circuits.
- `test/`: Foundry tests for payment validation, batch validation, and nullifier double-spend checks.

Run when Foundry is installed:

```bash
forge test
```

VeilShield is not production-ready and must not be deployed as audited confidential payment infrastructure until generated verifier contracts, a verifier adapter, prover integration, note discovery, indexing, and external audit are complete.
