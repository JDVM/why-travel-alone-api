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
const { issueAccountToken, consumeAccountToken } = require('../utils/accountTokens');
const mailer = require('../mailer');

const INVALID_LINK = 'This link is invalid or has expired.';

// Emails a fresh verification link.
async function sendVerificationEmail(account) {
    const token = await issueAccountToken(account.id, 'verify_email');
    await mailer.sendMail({ to: account.email, ...mailer.verificationEmail(token) });
}

// Runs after the response has been sent: failures are reported, not returned.
function inBackground(req, work, failureMessage) {
    work().catch((error) => reportError(req, error, failureMessage));
}

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
            return { id, email: normalizedEmail, email_verified: false, traveler: { user_id: userId, ...traveler } };
        });

        req.log.info({ event: 'auth.register', accountId: account.id }, 'Account registered');
        inBackground(req, () => sendVerificationEmail(account), 'Error sending verification email');
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
        return res.status(200).json({
            token,
            account: { id: account.id, email: account.email, email_verified: account.email_verified_at !== null, traveler },
        });
    } catch (error) {
        reportError(req, error, 'Error logging in');
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/me', authenticate, async (req, res) => {
    try {
        const { email_verified_at, ...account } = await knex('accounts')
            .select('id', 'email', 'auth_provider', 'created_at', 'email_verified_at')
            .where({ id: req.account.accountId })
            .first();

        // traveler is null only for accounts created before every account had
        // a profile; the frontend sends those users to the profile page.
        const traveler = await travelerSummary(account.id);
        return res.status(200).json({ ...account, email_verified: email_verified_at !== null, traveler });
    } catch (error) {
        reportError(req, error, 'Error fetching account');
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Confirms the email address from the link in the verification email. Works
// without being logged in, so the link can be opened on any device.
router.post('/verify-email', async (req, res) => {
    try {
        const accountId = await consumeAccountToken((req.body || {}).token, 'verify_email');
        if (!accountId) {
            return res.status(400).json({ error: `${INVALID_LINK} Log in to get a new one.` });
        }
        await knex('accounts').where({ id: accountId }).whereNull('email_verified_at').update({ email_verified_at: new Date() });
        req.log.info({ event: 'auth.email_verified', accountId }, 'Email verified');
        return res.status(200).json({ email_verified: true });
    } catch (error) {
        reportError(req, error, 'Error verifying email');
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/resend-verification', authenticate, async (req, res) => {
    if (req.account.emailVerified) {
        return res.status(200).json({ email_verified: true });
    }
    try {
        await sendVerificationEmail({ id: req.account.accountId, email: req.account.email });
        return res.status(202).json({ message: `We sent a new link to ${req.account.email}.` });
    } catch (error) {
        reportError(req, error, 'Error resending verification email');
        return res.status(503).json({ error: "We couldn't send the email just now. Please try again later." });
    }
});

// Always the same answer, sent before looking anything up, so the response
// (content and timing) never reveals whether an account exists.
router.post('/forgot-password', (req, res) => {
    const email = normalizeEmail((req.body || {}).email);
    if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'A valid email is required' });
    }
    res.status(202).json({ message: 'If an account uses that email, we sent it a link to reset the password.' });

    inBackground(
        req,
        async () => {
            const account = await knex('accounts').where({ email }).first('id', 'email', 'password_hash');
            if (!account || !account.password_hash) {
                return;
            }
            const token = await issueAccountToken(account.id, 'reset_password');
            await mailer.sendMail({ to: account.email, ...mailer.passwordResetEmail(token) });
            req.log.info({ event: 'auth.password_reset_requested', accountId: account.id }, 'Password reset requested');
        },
        'Error sending password reset email'
    );
});

// Sets a new password from the link in the reset email. Every existing
// session is signed out (see authenticate), and opening the emailed link also
// proves the address, so it counts as verified.
router.post('/reset-password', async (req, res) => {
    const { token, password } = req.body || {};
    const passwordError = newPasswordError(password);
    if (passwordError) {
        return res.status(400).json({ error: passwordError });
    }

    try {
        const password_hash = await hashPassword(password);
        const now = new Date();
        const account = await knex.transaction(async (trx) => {
            const accountId = await consumeAccountToken(token, 'reset_password', trx);
            if (!accountId) {
                return null;
            }
            await trx('accounts')
                .where({ id: accountId })
                .update({
                    password_hash,
                    password_changed_at: now,
                    email_verified_at: trx.raw('COALESCE(email_verified_at, ?)', [now]),
                });
            await trx('account_tokens').where({ account_id: accountId }).whereNull('used_at').del();
            return trx('accounts').where({ id: accountId }).first('id', 'email');
        });
        if (!account) {
            return res.status(400).json({ error: `${INVALID_LINK} Ask for a new one.` });
        }

        req.log.info({ event: 'auth.password_reset', accountId: account.id }, 'Password reset');
        inBackground(
            req,
            () => mailer.sendMail({ to: account.email, ...mailer.passwordChangedEmail() }),
            'Error sending password changed email'
        );
        return res.status(200).json({ message: 'Your password has been changed. Log in with your new password.' });
    } catch (error) {
        reportError(req, error, 'Error resetting password');
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
