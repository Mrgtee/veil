use ::veil_shield_shared;

fn main(
    owner: pub Field,
    token: pub Field,
    amount: u128,
    secret: Field,
    salt: Field,
) -> pub [Field; 2] {
    [
        veil_shield_shared::note_commitment(owner, token, amount, secret, salt),
        veil_shield_shared::nullifier(secret, salt),
    ]
}

#[test]
fn computes_note_commitment_and_nullifier() {
    let owner: Field = 1001;
    let token: Field = 3600;
    let amount: u128 = 42;
    let secret: Field = 4444;
    let salt: Field = 111;

    let result = main(owner, token, amount, secret, salt);

    assert(result[0] == veil_shield_shared::note_commitment(owner, token, amount, secret, salt));
    assert(result[1] == veil_shield_shared::nullifier(secret, salt));
}
