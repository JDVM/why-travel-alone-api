const crypto = require('crypto');
const cookie = require('cookie');
const knex = require('../db');

// Login sessions: a random id in an httpOnly cookie (out of reach of the
// page's JavaScript), checked against the sessions table on every request.
//
// A session ends after 14 days without use, or 30 days after login, and at
// once when its row is deleted (logout, "sign out other devices", password
// reset, account deletion).

const COOKIE_NAME = 'wta_session';
const IDLE_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
// Record activity at most this often, to save a database write per request.
const TOUCH_EVERY_MS = 5 * 60 * 1000;

function hashId(sessionId) {
    return crypto.createHash('sha256').update(sessionId).digest('hex');
}

function cookieOptions(env = process.env) {
    return {
        httpOnly: true,
        // Browsers treat http://localhost as secure, so this works locally too.
        // COOKIE_SECURE=false only for a plain-http setup that isn't localhost.
        secure: env.COOKIE_SECURE !== 'false',
        // Sent when the web app (e.g. app.example.com) calls the API on the same
        // site (api.example.com), never on requests started by other sites.
        sameSite: 'lax',
        path: '/',
        domain: env.COOKIE_DOMAIN || undefined,
    };
}

function readSessionId(req) {
    const header = req.headers.cookie;
    if (!header) {
        return null;
    }
    const value = cookie.parse(header)[COOKIE_NAME];
    return typeof value === 'string' && /^[\w-]{43}$/.test(value) ? value : null;
}

// Starts a session for the account and sets its cookie on the response.
async function startSession(req, res, accountId) {
    const sessionId = crypto.randomBytes(32).toString('base64url');
    const now = new Date();
    await knex('sessions').insert({
        id: hashId(sessionId),
        account_id: accountId,
        user_agent: (req.get('user-agent') || '').slice(0, 200) || null,
        created_at: now,
        last_seen_at: now,
        expires_at: new Date(now.getTime() + MAX_AGE_MS),
    });
    res.cookie(COOKIE_NAME, sessionId, { ...cookieOptions(), maxAge: MAX_AGE_MS });
}

// The live session for the request's cookie, with its account, or null.
async function currentSession(req) {
    const sessionId = readSessionId(req);
    if (!sessionId) {
        return null;
    }
    const id = hashId(sessionId);
    const session = await knex('sessions')
        .join('accounts', 'accounts.id', 'sessions.account_id')
        .where('sessions.id', id)
        .first(
            'sessions.id',
            'sessions.last_seen_at',
            'sessions.expires_at',
            'accounts.id as account_id',
            'accounts.email',
            'accounts.email_verified_at'
        );
    if (!session) {
        return null;
    }
    const now = Date.now();
    if (new Date(session.expires_at).getTime() <= now || new Date(session.last_seen_at).getTime() <= now - IDLE_MS) {
        await knex('sessions').where({ id }).del();
        return null;
    }
    if (new Date(session.last_seen_at).getTime() <= now - TOUCH_EVERY_MS) {
        await knex('sessions').where({ id }).update({ last_seen_at: new Date(now) });
    }
    return session;
}

async function endSession(req, res) {
    const sessionId = readSessionId(req);
    if (sessionId) {
        await knex('sessions').where({ id: hashId(sessionId) }).del();
    }
    res.clearCookie(COOKIE_NAME, cookieOptions());
}

// Ends every session of the account, except optionally the current one.
async function endAccountSessions(accountId, { except } = {}) {
    const query = knex('sessions').where({ account_id: accountId });
    if (except) {
        query.whereNot({ id: except });
    }
    return query.del();
}

module.exports = {
    COOKIE_NAME,
    IDLE_MS,
    MAX_AGE_MS,
    hashId,
    readSessionId,
    startSession,
    currentSession,
    endSession,
    endAccountSessions,
    cookieOptions,
};
