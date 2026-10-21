const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

function hashPassword(plain) {
    return bcrypt.hash(plain, SALT_ROUNDS);
}

// A hash of a random value, compared against when there's no real hash (an
// unknown email, or an account without a password). Doing the same bcrypt work
// either way keeps response times from revealing which emails are registered.
let dummyHash;
function getDummyHash() {
    if (!dummyHash) {
        dummyHash = bcrypt.hash(crypto.randomBytes(16).toString('hex'), SALT_ROUNDS);
    }
    return dummyHash;
}

async function verifyPassword(plain, hash) {
    if (!hash) {
        await bcrypt.compare(plain, await getDummyHash());
        return false;
    }
    return bcrypt.compare(plain, hash);
}

// True for hashes made with a lower cost than SALT_ROUNDS (accounts created
// before it was raised). Re-hashing them on their next successful login moves
// every account to the current cost, and keeps login timing the same for all.
function needsRehash(hash) {
    return bcrypt.getRounds(hash) < SALT_ROUNDS;
}

module.exports = { hashPassword, verifyPassword, needsRehash };
