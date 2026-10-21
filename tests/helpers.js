require('./env');
const crypto = require('crypto');
const { after } = require('node:test');
const supertest = require('supertest');
const createApp = require('../app');
const knex = require('../db');
const { hashPassword } = require('../utils/auth');
const { COOKIE_NAME, hashId, MAX_AGE_MS } = require('../utils/sessions');
const { TERMS_VERSION } = require('../config');

// Each test file runs in its own process; close its connection pool at the end.
after(() => knex.destroy());

// The seeded demo account (DB_Setup/seeds/accounts.js) owns trips 1-3.
const DEMO = { id: 1, email: 'demo@why-travel-alone.local', password: 'password123' };

// A fresh app per test, so rate-limit counters never leak between tests.
function api(env) {
    return supertest(createApp(env));
}

// The password of every account createAccount() makes.
const TEST_PASSWORD = 'test-password-123';
let sharedHash;

// The web app's origin in tests (the default CORS_ORIGIN). Requests that
// change something must come from it.
const ORIGIN = 'http://localhost:3000';

// Starts a session for the account directly in the database and returns the
// value of its cookie.
async function startTestSession(accountId) {
    const sessionId = crypto.randomBytes(32).toString('base64url');
    const now = new Date();
    await knex('sessions').insert({
        id: hashId(sessionId),
        account_id: accountId,
        user_agent: 'tests',
        created_at: now,
        last_seen_at: now,
        expires_at: new Date(now.getTime() + MAX_AGE_MS),
    });
    return sessionId;
}

// Creates an account directly in the database and returns it signed in. Faster than registering through the API, and doesn't count against
// the registration rate limit. Like a real signup it gets a traveler profile
// (with private details), unless { profile: false } asks for an older,
// profile-less account. Its email is verified unless { verified: false }.
async function createAccount({ profile = true, verified = true } = {}) {
    if (!sharedHash) {
        sharedHash = await hashPassword(TEST_PASSWORD);
    }
    const email = `test-${crypto.randomUUID()}@example.com`;
    const [id] = await knex('accounts').insert({
        email,
        password_hash: sharedHash,
        auth_provider: 'local',
        terms_accepted_at: new Date(),
        terms_version: TERMS_VERSION,
        email_verified_at: verified ? new Date() : null,
    });
    let travelerId;
    if (profile) {
        [travelerId] = await knex('users').insert({
            account_id: id,
            first_name: 'Test',
            last_name: `Traveler ${id}`,
            has_kids: true,
            special_considerations: 'Private note',
            sensitive_consent_at: new Date(),
        });
    }
    return { id, email, travelerId, session: await startTestSession(id) };
}

// Request headers for a signed-in browser on the web app.
function signedIn(account) {
    return { Cookie: `${COOKIE_NAME}=${account.session}`, Origin: ORIGIN };
}

// The same, using the session a login or registration response started.
function sessionFrom(res) {
    const setCookie = (res.headers['set-cookie'] || []).find((c) => c.startsWith(`${COOKIE_NAME}=`));
    if (!setCookie) {
        throw new Error('No session cookie in the response');
    }
    return { Cookie: setCookie.split(';')[0], Origin: ORIGIN };
}

// Signed in as the seeded demo account.
async function demoSession() {
    return signedIn({ session: await startTestSession(DEMO.id) });
}

const validTrip = (overrides = {}) => ({
    trip_name: 'Test trip',
    kid_friendly: false,
    trip_length: 5,
    destination_id: 1,
    notes: 'Testing',
    ...overrides,
});

module.exports = { api, knex, DEMO, ORIGIN, TEST_PASSWORD, createAccount, signedIn, sessionFrom, demoSession, validTrip };
