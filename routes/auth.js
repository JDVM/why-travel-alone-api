const express = require('express');
const router = express.Router();
const knex = require('../db');
const authenticate = require('../middleware/authenticate');
const { hashPassword, verifyPassword, generateToken } = require('../utils/auth');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

router.post('/register', async (req, res) => {
    const { email, password } = req.body || {};

    if (!email || !EMAIL_REGEX.test(email)) {
        return res.status(400).json({ error: 'A valid email is required' });
    }
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }

    try {
        const normalizedEmail = email.trim().toLowerCase();

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
        console.error('Error registering account', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const normalizedEmail = email.trim().toLowerCase();
        const account = await knex('accounts').where({ email: normalizedEmail }).first();

        // Return the same error whether the account is missing or the password is
        // wrong, so we don't reveal which emails are registered.
        const ok = account && (await verifyPassword(password, account.password_hash));
        if (!ok) {
            return res.status(401).json({ error: 'Invalid email or password' });
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
