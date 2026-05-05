use ::veil_shield_shared;

fn main(
    amount: u128,
    secret: Field,
    salt: Field,
    owner: pub Field,
    token: pub Field,
    commitment: pub Field,
    nullifier_hash: pub Field,
    withdraw_amount: pub u128,
) {
    assert(withdraw_amount == amount, "withdraw amount must match note amount");

    let expected_commitment = veil_shield_shared::note_commitment(owner, token, amount, secret, salt);
    assert(commitment == expected_commitment, "bad commitment");

    let expected_nullifier = veil_shield_shared::nullifier(secret, salt);
    assert(nullifier_hash == expected_nullifier, "bad nullifier");
}

#[test]
fn valid_withdraw_witness_passes() {
    let amount: u128 = 42;
    let secret: Field = 4444;
    let salt: Field = 111;
    let owner: Field = 1001;
    let token: Field = 3600;
    let commitment = veil_shield_shared::note_commitment(owner, token, amount, secret, salt);
    let nullifier_hash = veil_shield_shared::nullifier(secret, salt);

    main(amount, secret, salt, owner, token, commitment, nullifier_hash, amount);
}

#[test(should_fail_with = "withdraw amount must match note amount")]
fn amount_mismatch_fails() {
    let amount: u128 = 42;
    let secret: Field = 4444;
    let salt: Field = 111;
    let owner: Field = 1001;
    let token: Field = 3600;
    let commitment = veil_shield_shared::note_commitment(owner, token, amount, secret, salt);
    let nullifier_hash = veil_shield_shared::nullifier(secret, salt);

    main(amount, secret, salt, owner, token, commitment, nullifier_hash, 41);
}

#[test(should_fail_with = "bad commitment")]
fn wrong_commitment_fails() {
    let amount: u128 = 42;
    let secret: Field = 4444;
    let salt: Field = 111;
    let owner: Field = 1001;
    let token: Field = 3600;
    let commitment: Field = 999999;
    let nullifier_hash = veil_shield_shared::nullifier(secret, salt);

    main(amount, secret, salt, owner, token, commitment, nullifier_hash, amount);
}

#[test(should_fail_with = "bad nullifier")]
fn wrong_nullifier_fails() {
    let amount: u128 = 42;
    let secret: Field = 4444;
    let salt: Field = 111;
    let owner: Field = 1001;
    let token: Field = 3600;
    let commitment = veil_shield_shared::note_commitment(owner, token, amount, secret, salt);
    let nullifier_hash: Field = 888888;

    main(amount, secret, salt, owner, token, commitment, nullifier_hash, amount);
}
