const crypto = require('crypto');
const knex = require('../db');

// One-time tokens for links sent by email (verify an address, reset a
// password). The raw token only ever exists in the email; the database keeps
// its SHA-256 hash.

const TTL_MS = {
    verify_email: 48 * 60 * 60 * 1000,
    reset_password: 60 * 60 * 1000,
};

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

// Issues a new token, replacing any unused ones for the same purpose so only
// the most recent email's link works.
async function issueAccountToken(accountId, purpose) {
    const token = crypto.randomBytes(32).toString('base64url');
    await knex.transaction(async (trx) => {
        await trx('account_tokens').where({ account_id: accountId, purpose }).whereNull('used_at').del();
        await trx('account_tokens').insert({
            account_id: accountId,
            purpose,
            token_hash: hashToken(token),
            expires_at: new Date(Date.now() + TTL_MS[purpose]),
        });
    });
    return token;
}

// Marks the token used and returns its account id, or null when the token is
// unknown, expired, already used or for another purpose. The conditional
// update makes using a token twice at the same moment impossible.
async function consumeAccountToken(token, purpose, trx = knex) {
    if (typeof token !== 'string' || token.length < 20 || token.length > 100) {
        return null;
    }
    const row = await trx('account_tokens')
        .where({ token_hash: hashToken(token), purpose })
        .whereNull('used_at')
        .where('expires_at', '>', new Date())
        .first('id', 'account_id');
    if (!row) {
        return null;
    }
    const updated = await trx('account_tokens').where({ id: row.id }).whereNull('used_at').update({ used_at: new Date() });
    return updated === 1 ? row.account_id : null;
}

module.exports = { issueAccountToken, consumeAccountToken, hashToken, TTL_MS };
