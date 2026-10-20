require('./env');
const crypto = require('crypto');
const { after } = require('node:test');
const supertest = require('supertest');
const createApp = require('../app');
const knex = require('../db');
const { hashPassword, generateToken } = require('../utils/auth');

// Each test file runs in its own process; close its connection pool at the end.
after(() => knex.destroy());

// The seeded demo account (DB_Setup/seeds/accounts.js) owns trips 1-3.
const DEMO = { id: 1, email: 'demo@why-travel-alone.local', password: 'password123' };

// A fresh app per test, so rate-limit counters never leak between tests.
function api(env) {
    return supertest(createApp(env));
}

let sharedHash;

// Creates an account directly in the database and returns it with a valid
// token. Faster than registering through the API, and doesn't count against
// the registration rate limit. Like a real signup it gets a traveler profile
// (with private details), unless { profile: false } asks for an older,
// profile-less account.
async function createAccount({ profile = true } = {}) {
    if (!sharedHash) {
        sharedHash = await hashPassword('test-password-123');
    }
    const email = `test-${crypto.randomUUID()}@example.com`;
    const [id] = await knex('accounts').insert({ email, password_hash: sharedHash, auth_provider: 'local' });
    let travelerId;
    if (profile) {
        [travelerId] = await knex('users').insert({
            account_id: id,
            first_name: 'Test',
            last_name: `Traveler ${id}`,
            has_kids: true,
            special_considerations: 'Private note',
        });
    }
    return { id, email, travelerId, token: generateToken({ id, email }) };
}

function bearer(account) {
    return { Authorization: `Bearer ${account.token}` };
}

function demoToken() {
    return { Authorization: `Bearer ${generateToken({ id: DEMO.id, email: DEMO.email })}` };
}

const validTrip = (overrides = {}) => ({
    trip_name: 'Test trip',
    kid_friendly: false,
    trip_length: 5,
    destination_id: 1,
    notes: 'Testing',
    ...overrides,
});

module.exports = { api, knex, DEMO, createAccount, bearer, demoToken, validTrip };
