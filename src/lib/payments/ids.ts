export function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function makeBytes32Id() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);

  return `0x${Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}` as `0x${string}`;
}

export function makeCommitmentId() {
  return makeBytes32Id();
}

