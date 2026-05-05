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
) -> pub [Field; 4] {
    assert(transfer_amount > 0, "transfer amount must be positive");
    assert(input_amount == transfer_amount + change_amount, "amounts must balance");

    [
        veil_shield_shared::note_commitment(sender, token, input_amount, secret, input_salt),
        veil_shield_shared::transfer_output_commitment(recipient, token, transfer_amount, output_salt),
        veil_shield_shared::note_commitment(sender, token, change_amount, secret, change_salt),
        veil_shield_shared::nullifier(secret, input_salt),
    ]
}

#[test]
fn computes_transfer_public_inputs() {
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

    let result = main(
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
    );

    assert(result[0] == veil_shield_shared::note_commitment(sender, token, input_amount, secret, input_salt));
    assert(result[1] == veil_shield_shared::transfer_output_commitment(recipient, token, transfer_amount, output_salt));
    assert(result[2] == veil_shield_shared::note_commitment(sender, token, change_amount, secret, change_salt));
    assert(result[3] == veil_shield_shared::nullifier(secret, input_salt));
}
