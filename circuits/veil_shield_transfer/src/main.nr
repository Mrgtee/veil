use ::veil_shield_shared;

fn main(
    input_amount: u128,
    transfer_amount: u128,
    change_amount: u128,
    secret: Field,
    input_salt: Field,
    output_salt: Field,
    change_salt: Field,
    sender: pub Field,
    recipient: pub Field,
    token: pub Field,
    input_commitment: pub Field,
    output_commitment: pub Field,
    change_commitment: pub Field,
    nullifier_hash: pub Field,
) {
    assert(transfer_amount > 0, "transfer amount must be positive");
    assert(input_amount == transfer_amount + change_amount, "amounts must balance");

    let expected_input_commitment = veil_shield_shared::note_commitment(
        sender,
        token,
        input_amount,
        secret,
        input_salt,
    );
    assert(input_commitment == expected_input_commitment, "bad input commitment");

    let expected_output_commitment = veil_shield_shared::transfer_output_commitment(
        recipient,
        token,
        transfer_amount,
        output_salt,
    );
    assert(output_commitment == expected_output_commitment, "bad output commitment");

    let expected_change_commitment = veil_shield_shared::note_commitment(
        sender,
        token,
        change_amount,
        secret,
        change_salt,
    );
    assert(change_commitment == expected_change_commitment, "bad change commitment");

    let expected_nullifier = veil_shield_shared::nullifier(secret, input_salt);
    assert(nullifier_hash == expected_nullifier, "bad nullifier");
}

#[test]
fn valid_transfer_witness_passes() {
    let input_amount: u128 = 100;
    let transfer_amount: u128 = 35;
    let change_amount: u128 = 65;
    let secret: Field = 4444;
    let input_salt: Field = 111;
    let output_salt: Field = 222;
    let change_salt: Field = 333;
    let sender: Field = 1001;
    let recipient: Field = 2002;
    let token: Field = 3600;

    let input_commitment = veil_shield_shared::note_commitment(sender, token, input_amount, secret, input_salt);
    let output_commitment = veil_shield_shared::transfer_output_commitment(recipient, token, transfer_amount, output_salt);
    let change_commitment = veil_shield_shared::note_commitment(sender, token, change_amount, secret, change_salt);
    let nullifier_hash = veil_shield_shared::nullifier(secret, input_salt);

    main(
        input_amount,
        transfer_amount,
        change_amount,
        secret,
        input_salt,
        output_salt,
        change_salt,
        sender,
        recipient,
        token,
        input_commitment,
        output_commitment,
        change_commitment,
        nullifier_hash,
    );
}

#[test(should_fail_with = "transfer amount must be positive")]
fn zero_transfer_fails() {
    let input_amount: u128 = 100;
    let transfer_amount: u128 = 0;
    let change_amount: u128 = 100;
    let secret: Field = 4444;
    let input_salt: Field = 111;
    let output_salt: Field = 222;
    let change_salt: Field = 333;
    let sender: Field = 1001;
    let recipient: Field = 2002;
    let token: Field = 3600;

    let input_commitment = veil_shield_shared::note_commitment(sender, token, input_amount, secret, input_salt);
    let output_commitment = veil_shield_shared::transfer_output_commitment(recipient, token, transfer_amount, output_salt);
    let change_commitment = veil_shield_shared::note_commitment(sender, token, change_amount, secret, change_salt);
    let nullifier_hash = veil_shield_shared::nullifier(secret, input_salt);

    main(
        input_amount,
        transfer_amount,
        change_amount,
        secret,
        input_salt,
        output_salt,
        change_salt,
        sender,
        recipient,
        token,
        input_commitment,
        output_commitment,
        change_commitment,
        nullifier_hash,
    );
}

#[test(should_fail_with = "amounts must balance")]
fn input_amount_mismatch_fails() {
    let input_amount: u128 = 100;
    let transfer_amount: u128 = 35;
    let change_amount: u128 = 60;
    let secret: Field = 4444;
    let input_salt: Field = 111;
    let output_salt: Field = 222;
    let change_salt: Field = 333;
    let sender: Field = 1001;
    let recipient: Field = 2002;
    let token: Field = 3600;

    let input_commitment = veil_shield_shared::note_commitment(sender, token, input_amount, secret, input_salt);
    let output_commitment = veil_shield_shared::transfer_output_commitment(recipient, token, transfer_amount, output_salt);
    let change_commitment = veil_shield_shared::note_commitment(sender, token, 65, secret, change_salt);
    let nullifier_hash = veil_shield_shared::nullifier(secret, input_salt);

    main(
        input_amount,
        transfer_amount,
        change_amount,
        secret,
        input_salt,
        output_salt,
        change_salt,
        sender,
        recipient,
        token,
        input_commitment,
        output_commitment,
        change_commitment,
        nullifier_hash,
    );
}

#[test(should_fail_with = "bad input commitment")]
fn wrong_commitment_fails() {
    let input_amount: u128 = 100;
    let transfer_amount: u128 = 35;
    let change_amount: u128 = 65;
    let secret: Field = 4444;
    let input_salt: Field = 111;
    let output_salt: Field = 222;
    let change_salt: Field = 333;
    let sender: Field = 1001;
    let recipient: Field = 2002;
    let token: Field = 3600;

    let input_commitment: Field = 999999;
    let output_commitment = veil_shield_shared::transfer_output_commitment(recipient, token, transfer_amount, output_salt);
    let change_commitment = veil_shield_shared::note_commitment(sender, token, change_amount, secret, change_salt);
    let nullifier_hash = veil_shield_shared::nullifier(secret, input_salt);

    main(
        input_amount,
        transfer_amount,
        change_amount,
        secret,
        input_salt,
        output_salt,
        change_salt,
        sender,
        recipient,
        token,
        input_commitment,
        output_commitment,
        change_commitment,
        nullifier_hash,
    );
}

#[test(should_fail_with = "bad nullifier")]
fn wrong_nullifier_fails() {
    let input_amount: u128 = 100;
    let transfer_amount: u128 = 35;
    let change_amount: u128 = 65;
    let secret: Field = 4444;
    let input_salt: Field = 111;
    let output_salt: Field = 222;
    let change_salt: Field = 333;
    let sender: Field = 1001;
    let recipient: Field = 2002;
    let token: Field = 3600;

    let input_commitment = veil_shield_shared::note_commitment(sender, token, input_amount, secret, input_salt);
    let output_commitment = veil_shield_shared::transfer_output_commitment(recipient, token, transfer_amount, output_salt);
    let change_commitment = veil_shield_shared::note_commitment(sender, token, change_amount, secret, change_salt);
    let nullifier_hash: Field = 888888;

    main(
        input_amount,
        transfer_amount,
        change_amount,
        secret,
        input_salt,
        output_salt,
        change_salt,
        sender,
        recipient,
        token,
        input_commitment,
        output_commitment,
        change_commitment,
        nullifier_hash,
    );
}
