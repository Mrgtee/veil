import { describe, expect, it } from "vitest";
import {
  addressToField,
  makeTransferArtifact,
  proofFieldsToBytes,
  validateTransferArtifact,
  validateWithdrawArtifact,
} from "../../scripts/lib/veilshield-artifacts.mjs";

const sender = "0xfE84F8661D575B4fEd8BEAFcbF6b3Fa9c4f9207F";
const recipient = "0x30c77c1C20A5cBB171DE9090789F3dB98aA9734b";
const token = "0x3600000000000000000000000000000000000000";
const proofFields = [
  `0x${"11".repeat(32)}`,
  `0x${"22".repeat(32)}`,
];
const proof = {
  fields: proofFields,
  bytes: proofFieldsToBytes(proofFields),
  publicInputs: [] as string[],
  bbVersion: "test",
  scheme: "ultra_honk",
};

describe("VeilShield proof artifacts", () => {
  it("packs bb proof fields into calldata bytes", () => {
    expect(proofFieldsToBytes(proofFields)).toBe(`0x${"11".repeat(32)}${"22".repeat(32)}`);
    expect(() => proofFieldsToBytes(["0x1234"])).toThrow("bytes32");
  });

  it("validates transfer artifact public input order and proof bytes", () => {
    const inputCommitment = `0x${"aa".repeat(32)}`;
    const outputCommitment = `0x${"bb".repeat(32)}`;
    const changeCommitment = `0x${"cc".repeat(32)}`;
    const nullifier = `0x${"dd".repeat(32)}`;
    const transferProof = {
      ...proof,
      publicInputs: [
        addressToField(sender),
        addressToField(recipient),
        addressToField(token),
        inputCommitment,
        outputCommitment,
        changeCommitment,
        nullifier,
      ],
    };

    const artifact = makeTransferArtifact({
      proof: transferProof,
      sender: addressToField(sender),
      recipient: addressToField(recipient),
      token: addressToField(token),
      inputCommitment,
      outputCommitment,
      changeCommitment,
      nullifier,
      inputAmount: "1000000",
      transferAmount: "250000",
      changeAmount: "750000",
      secret: `0x${"01".repeat(32)}`,
      inputSalt: `0x${"02".repeat(32)}`,
      outputSalt: `0x${"03".repeat(32)}`,
      changeSalt: `0x${"04".repeat(32)}`,
    });

    expect(validateTransferArtifact(artifact).publicInputs.outputCommitment).toBe(outputCommitment);
    expect(artifact.ledger.amountHidden).toBe(true);
    expect(artifact.localPrivate.transferAmountBase).toBe("250000");
  });

  it("rejects malformed artifacts before submission", () => {
    expect(() => validateTransferArtifact({ kind: "transfer" })).toThrow("Unsupported artifact version");
    expect(() =>
      validateWithdrawArtifact({
        artifactVersion: 1,
        kind: "withdraw",
        proof: { encoding: "bb-proof-field-array-concat", bytes: "0x1234", fields: ["0x1234"] },
        publicInputs: { ordered: [] },
      })
    ).toThrow("Proof field");
  });
});
