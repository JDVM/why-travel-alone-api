const express = require('express');
const router = express.Router();
const knex = require('../db');
const authenticate = require('../middleware/authenticate');
const { hashPassword, verifyPassword, needsRehash, generateToken } = require('../utils/auth');
const { normalizeEmail, isValidEmail, isPasswordTooLong, newPasswordError } = require('../utils/validate');

router.post('/register', async (req, res) => {
    const { email, password } = req.body || {};

    // Normalize before validating so an address pasted with surrounding
    // whitespace or mixed case is accepted (and stored) in its canonical form.
    const normalizedEmail = normalizeEmail(email);

    if (!isValidEmail(normalizedEmail)) {
        return res.status(400).json({ error: 'A valid email is required' });
    }
    const passwordError = newPasswordError(password);
    if (passwordError) {
        return res.status(400).json({ error: passwordError });
    }

    try {

        const existing = await knex('accounts').where({ email: normalizedEmail }).first();
        if (existing) {
            return res.status(409).json({ error: 'An account with that email already exists' });
        }

        const password_hash = await hashPassword(password);
        const [id] = await knex('accounts').insert({
            email: normalizedEmail,
            password_hash,
            auth_provider: 'local',
        });

        const account = { id, email: normalizedEmail };
        const token = generateToken(account);
        return res.status(201).json({ token, account });
    } catch (error) {
        // Two concurrent registrations for the same email: the unique index wins.
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'An account with that email already exists' });
        }
        console.error('Error registering account', error);
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
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        if (needsRehash(account.password_hash)) {
            await knex('accounts')
                .where({ id: account.id })
                .update({ password_hash: await hashPassword(password) });
        }

        const token = generateToken(account);
        return res.status(200).json({ token, account: { id: account.id, email: account.email } });
    } catch (error) {
        console.error('Error logging in', error);
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
        return res.status(200).json(account);
    } catch (error) {
        console.error('Error fetching account', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
