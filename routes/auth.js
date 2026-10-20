const express = require('express');
const router = express.Router();
const knex = require('../db');
const reportError = require('../utils/reportError');
const { emailTag } = require('../logger');
const { TERMS_VERSION } = require('../config');
const authenticate = require('../middleware/authenticate');
const { hashPassword, verifyPassword, needsRehash, generateToken } = require('../utils/auth');
const { normalizeEmail, isValidEmail, isPasswordTooLong, newPasswordError, nameError } = require('../utils/validate');
const { travelerSummary } = require('../utils/travelers');

// Every account is a traveler: registration takes a name and creates the
// traveler profile with the account. The rest of the profile is filled in
// later through PUT /profile.
router.post('/register', async (req, res) => {
    const { email, password, first_name, last_name, accept_terms } = req.body || {};

    // Normalize before validating so an address pasted with surrounding
    // whitespace or mixed case is accepted (and stored) in its canonical form.
    const normalizedEmail = normalizeEmail(email);

    if (!isValidEmail(normalizedEmail)) {
        return res.status(400).json({ error: 'A valid email is required' });
    }
    const fieldError =
        newPasswordError(password) || nameError(first_name, 'First name') || nameError(last_name, 'Last name');
    if (fieldError) {
        return res.status(400).json({ error: fieldError });
    }
    if (accept_terms !== true) {
        return res.status(400).json({ error: 'You must accept the terms and privacy policy to create an account' });
    }

    try {

        const existing = await knex('accounts').where({ email: normalizedEmail }).first();
        if (existing) {
            return res.status(409).json({ error: 'An account with that email already exists' });
        }

        const password_hash = await hashPassword(password);
        const traveler = { first_name: first_name.trim(), last_name: last_name.trim() };
        const account = await knex.transaction(async (trx) => {
            const [id] = await trx('accounts').insert({
                email: normalizedEmail,
                password_hash,
                auth_provider: 'local',
                terms_accepted_at: new Date(),
                terms_version: TERMS_VERSION,
            });
            const [userId] = await trx('users').insert({ ...traveler, account_id: id });
            return { id, email: normalizedEmail, traveler: { user_id: userId, ...traveler } };
        });

        req.log.info({ event: 'auth.register', accountId: account.id }, 'Account registered');
        const token = generateToken(account);
        return res.status(201).json({ token, account });
    } catch (error) {
        // Two concurrent registrations for the same email: the unique index wins.
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'An account with that email already exists' });
        }
        reportError(req, error, 'Error registering account');
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body || {};

    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const normalizedEmail = normalizeEmail(email);
        // Passwords over bcrypt's 72-byte limit can't be checked correctly, so
        // treat them like an unknown account (still doing the same hash work).
        const account = isValidEmail(normalizedEmail) && !isPasswordTooLong(password)
            ? await knex('accounts').where({ email: normalizedEmail }).first()
            : undefined;

        // Same error, and the same bcrypt work, whether the account is missing or
        // the password is wrong, so neither the message nor the response time
        // reveals which emails are registered.
        const ok = await verifyPassword(password, account ? account.password_hash : null);
        if (!account || !ok) {
            // The email is logged as a keyed hash: enough to see repeated
            // attempts against one address without storing the address.
            req.log.warn(
                { event: 'auth.login_failed', emailTag: emailTag(normalizedEmail), knownAccount: Boolean(account) },
                'Login failed'
            );
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        if (needsRehash(account.password_hash)) {
            await knex('accounts')
                .where({ id: account.id })
                .update({ password_hash: await hashPassword(password) });
        }

        req.log.info({ event: 'auth.login', accountId: account.id }, 'Logged in');
        const token = generateToken(account);
        const traveler = await travelerSummary(account.id);
        return res.status(200).json({ token, account: { id: account.id, email: account.email, traveler } });
    } catch (error) {
        reportError(req, error, 'Error logging in');
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/me', authenticate, async (req, res) => {
    try {
        const account = await knex('accounts')
            .select('id', 'email', 'auth_provider', 'created_at')
            .where({ id: req.account.accountId })
            .first();

        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }
        // traveler is null only for accounts created before every account had
        // a profile; the frontend sends those users to the profile page.
        const traveler = await travelerSummary(account.id);
        return res.status(200).json({ ...account, traveler });
    } catch (error) {
        reportError(req, error, 'Error fetching account');
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
