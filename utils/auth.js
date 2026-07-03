const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = process.env.JWT_EXPIRY || '7d';

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

function verifyPassword(plain, hash) {
    if (!hash) return Promise.resolve(false);
    return bcrypt.compare(plain, hash);
}

function generateToken(account) {
    return jwt.sign(
        { accountId: account.id, email: account.email },
        getSecret(),
        { expiresIn: TOKEN_EXPIRY }
    );
}

function verifyToken(token) {
    return jwt.verify(token, getSecret());
}

module.exports = { hashPassword, verifyPassword, generateToken, verifyToken };
