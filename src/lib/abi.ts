export const paymentVaultAbi = [
  {
    type: "function",
    name: "payOpen",
    stateMutability: "payable",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "externalId", type: "bytes32" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "payConfidential",
    stateMutability: "payable",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "commitmentId", type: "bytes32" },
      { name: "externalId", type: "bytes32" }
    ],
    outputs: []
  }
] as const;

export const batchPayoutAbi = [
  {
    type: "function",
    name: "payBatchOpen",
    stateMutability: "payable",
    inputs: [
      { name: "recipients", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
      { name: "batchId", type: "bytes32" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "payBatchConfidential",
    stateMutability: "payable",
    inputs: [
      { name: "recipients", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
      { name: "batchCommitment", type: "bytes32" },
      { name: "batchId", type: "bytes32" }
    ],
    outputs: []
  }
] as const;

export const veilHubAbi = [
  {
    type: "function",
    name: "payOpen",
    stateMutability: "nonpayable",
    inputs: [
      { name: "paymentId", type: "bytes32" },
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "reference", type: "bytes32" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "payOpenBatch",
    stateMutability: "nonpayable",
    inputs: [
      { name: "batchId", type: "bytes32" },
      { name: "recipients", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
      { name: "paymentIds", type: "bytes32[]" },
      { name: "reference", type: "bytes32" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "recordUnifiedBalanceOpenPayment",
    stateMutability: "nonpayable",
    inputs: [
      { name: "paymentId", type: "bytes32" },
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "settlementReference", type: "bytes32" }
    ],
    outputs: []
  }
] as const;
