const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SALT_ROUNDS = 12;
const TOKEN_EXPIRY = process.env.JWT_EXPIRY || '7d';
// Pinned so a token can't choose its own verification algorithm.
const JWT_ALGORITHM = 'HS256';

// Read the secret lazily so the app can boot (e.g. run migrations) without it,
// and fail loudly the moment we actually try to sign or verify a token.
function getSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is not set. Refusing to sign or verify tokens without it.');
    }
    return secret;
}

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

function generateToken(account) {
    return jwt.sign(
        { accountId: account.id, email: account.email },
        getSecret(),
        { expiresIn: TOKEN_EXPIRY, algorithm: JWT_ALGORITHM }
    );
}

function verifyToken(token) {
    return jwt.verify(token, getSecret(), { algorithms: [JWT_ALGORITHM] });
}

module.exports = { hashPassword, verifyPassword, needsRehash, generateToken, verifyToken };
