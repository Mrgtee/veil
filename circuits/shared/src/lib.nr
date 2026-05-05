use std::hash::pedersen_hash;

pub fn note_commitment(owner: Field, token: Field, amount: u128, secret: Field, salt: Field) -> Field {
    pedersen_hash([owner, token, amount as Field, secret, salt])
}

pub fn transfer_output_commitment(recipient: Field, token: Field, amount: u128, output_salt: Field) -> Field {
    pedersen_hash([recipient, token, amount as Field, output_salt])
}

pub fn nullifier(secret: Field, salt: Field) -> Field {
    pedersen_hash([secret, salt])
}
