const crypto = require('crypto');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { api, knex, TEST_PASSWORD, createAccount, signedIn, sessionFrom, validTrip } = require('./helpers');
const { outbox } = require('../mailer');

const uniqueEmail = () => `mail-${crypto.randomUUID()}@example.com`;

// Emails are sent after the response, so wait for them to arrive.
async function mailTo(email, subject, { count = 1 } = {}) {
    for (let i = 0; i < 100; i += 1) {
        const messages = outbox.filter((m) => m.to === email && subject.test(m.subject));
        if (messages.length >= count) {
            return messages[count - 1];
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`No email to ${email} matching ${subject}`);
}

const linkToken = (message) => message.text.match(/token=([\w-]+)/)[1];

async function register(email = uniqueEmail()) {
    const res = await api()
        .post('/auth/register')
        .send({ email, password: 'a-good-password', first_name: 'Ema', last_name: 'Il', accept_terms: true });
    assert.equal(res.status, 201);
    return { email, session: sessionFrom(res), account: res.body.account };
}

describe('email verification', () => {
    it('emails a link at signup and confirms the address when it is opened', async () => {
        const { email, session, account } = await register();
        assert.equal(account.email_verified, false);
        assert.equal((await api().get('/auth/me').set(session)).body.email_verified, false);

        const message = await mailTo(email, /confirm your email/i);
        assert.match(message.text, /http:\/\/localhost:3000\/verify-email\?token=[\w-]{43}/);

        const verify = await api().post('/auth/verify-email').send({ token: linkToken(message) });
        assert.equal(verify.status, 200);
        assert.equal((await api().get('/auth/me').set(session)).body.email_verified, true);

        // Links are single-use.
        assert.equal((await api().post('/auth/verify-email').send({ token: linkToken(message) })).status, 400);
    });

    it('stores only a hash of each link token', async () => {
        const { email, account } = await register();
        const raw = linkToken(await mailTo(email, /confirm your email/i));
        const row = await knex('account_tokens').where({ account_id: account.id }).first();
        assert.notEqual(row.token_hash, raw);
        assert.equal(row.token_hash, crypto.createHash('sha256').update(raw).digest('hex'));
    });

    it('rejects unknown, malformed and expired links', async () => {
        for (const token of [undefined, 'short', 'x'.repeat(43), { $ne: null }]) {
            assert.equal((await api().post('/auth/verify-email').send({ token })).status, 400, JSON.stringify(token));
        }
        const { email, account } = await register();
        const raw = linkToken(await mailTo(email, /confirm your email/i));
        await knex('account_tokens').where({ account_id: account.id }).update({ expires_at: new Date(Date.now() - 1000) });
        assert.equal((await api().post('/auth/verify-email').send({ token: raw })).status, 400);
    });

    it('resends a link, after which only the newest one works', async () => {
        const { email, session } = await register();
        const first = linkToken(await mailTo(email, /confirm your email/i));

        assert.equal((await api().post('/auth/resend-verification')).status, 401);
        const resend = await api().post('/auth/resend-verification').set(session);
        assert.equal(resend.status, 202);
        const second = linkToken(await mailTo(email, /confirm your email/i, { count: 2 }));

        assert.equal((await api().post('/auth/verify-email').send({ token: first })).status, 400);
        assert.equal((await api().post('/auth/verify-email').send({ token: second })).status, 200);

        const again = await api().post('/auth/resend-verification').set(session);
        assert.equal(again.status, 200);
        assert.equal(again.body.email_verified, true);
    });

    it('is required to send or accept invitations', async () => {
        const verifiedOwner = await createAccount();
        const unverifiedOwner = await createAccount({ verified: false });
        const unverifiedGuest = await createAccount({ verified: false });

        const ownTrip = (await api().post('/trips/new').set(signedIn(unverifiedOwner)).send(validTrip())).body.trip;
        const blocked = await api()
            .post(`/trips/${ownTrip}/invitations`)
            .set(signedIn(unverifiedOwner))
            .send({ user_id: unverifiedGuest.travelerId });
        assert.equal(blocked.status, 403);
        assert.match(blocked.body.error, /confirm your email/i);

        const trip = (await api().post('/trips/new').set(signedIn(verifiedOwner)).send(validTrip())).body.trip;
        await api().post(`/trips/${trip}/invitations`).set(signedIn(verifiedOwner)).send({ user_id: unverifiedGuest.travelerId });
        const [invitation] = (await api().get('/invitations').set(signedIn(unverifiedGuest))).body;
        assert.equal(
            (await api().post(`/invitations/${invitation.invitation_id}/accept`).set(signedIn(unverifiedGuest))).status,
            403
        );
        // Declining needs no verification.
        assert.equal(
            (await api().post(`/invitations/${invitation.invitation_id}/decline`).set(signedIn(unverifiedGuest))).status,
            204
        );
    });
});

describe('password reset', () => {
    it('answers the same way whether or not the account exists, and only emails real accounts', async () => {
        assert.equal((await api().post('/auth/forgot-password').send({ email: 'not-an-email' })).status, 400);

        const unknown = uniqueEmail();
        const missing = await api().post('/auth/forgot-password').send({ email: unknown });
        const account = await createAccount();
        const found = await api().post('/auth/forgot-password').send({ email: account.email.toUpperCase() });

        assert.equal(missing.status, 202);
        assert.equal(found.status, 202);
        assert.deepEqual(missing.body, found.body);
        await mailTo(account.email, /reset your password/i);
        assert.equal(outbox.some((m) => m.to === unknown), false);
    });

    it('sets a new password once, signs out other sessions and sends a notice', async () => {
        const account = await createAccount({ verified: false });
        const otherDevice = signedIn(account);
        assert.equal((await api().get('/auth/me').set(otherDevice)).status, 200);

        await api().post('/auth/forgot-password').send({ email: account.email });
        const token = linkToken(await mailTo(account.email, /reset your password/i));
        assert.match((await mailTo(account.email, /reset your password/i)).text, /\/reset-password\?token=/);

        assert.equal((await api().post('/auth/reset-password').send({ token, password: 'short' })).status, 400);
        const reset = await api().post('/auth/reset-password').send({ token, password: 'a-brand-new-password' });
        assert.equal(reset.status, 200);
        await mailTo(account.email, /password was changed/i);

        // The link is used up.
        assert.equal((await api().post('/auth/reset-password').send({ token, password: 'another-password' })).status, 400);

        // Old sessions are signed out; the old password no longer works; the new one does.
        assert.equal((await api().get('/auth/me').set(otherDevice)).status, 401);
        assert.equal((await api().post('/auth/login').send({ email: account.email, password: TEST_PASSWORD })).status, 401);
        const login = await api().post('/auth/login').send({ email: account.email, password: 'a-brand-new-password' });
        assert.equal(login.status, 200);
        assert.equal((await api().get('/auth/me').set(sessionFrom(login))).status, 200);

        // Opening the emailed link proved the address.
        assert.equal(login.body.account.email_verified, true);
    });

    it('signs out a session started a moment before the reset, and after an earlier one', async () => {
        // A session started just before the change must not survive it.
        const account = await createAccount();
        const resetPassword = async (password) => {
            await api().post('/auth/forgot-password').send({ email: account.email });
            const count = outbox.filter((m) => m.to === account.email && /reset your password/i.test(m.subject)).length;
            const token = linkToken(await mailTo(account.email, /reset your password/i, { count: count + 1 }));
            assert.equal((await api().post('/auth/reset-password').send({ token, password })).status, 200);
        };

        await resetPassword('first-new-password');
        assert.equal((await api().get('/auth/me').set(signedIn(account))).status, 401);

        const login = await api().post('/auth/login').send({ email: account.email, password: 'first-new-password' });
        const afterFirst = sessionFrom(login);
        assert.equal((await api().get('/auth/me').set(afterFirst)).status, 200);

        await resetPassword('second-new-password');
        assert.equal((await api().get('/auth/me').set(afterFirst)).status, 401);
    });

    it('rejects expired and wrong-purpose links', async () => {
        const { email } = await register();
        const verifyToken = linkToken(await mailTo(email, /confirm your email/i));
        assert.equal(
            (await api().post('/auth/reset-password').send({ token: verifyToken, password: 'a-good-password' })).status,
            400
        );

        await api().post('/auth/forgot-password').send({ email });
        const resetToken = linkToken(await mailTo(email, /reset your password/i));
        await knex('account_tokens').where({ purpose: 'reset_password' }).update({ expires_at: new Date(Date.now() - 1000) });
        assert.equal(
            (await api().post('/auth/reset-password').send({ token: resetToken, password: 'a-good-password' })).status,
            400
        );
    });

    it('limits how many reset emails one client can trigger', async () => {
        const app = api();
        for (let i = 0; i < 5; i += 1) {
            assert.equal((await app.post('/auth/forgot-password').send({ email: uniqueEmail() })).status, 202);
        }
        assert.equal((await app.post('/auth/forgot-password').send({ email: uniqueEmail() })).status, 429);
    });

    it('removes pending links when the account is deleted', async () => {
        const account = await createAccount();
        await api().post('/auth/forgot-password').send({ email: account.email });
        await mailTo(account.email, /reset your password/i);
        await api().delete('/account').set(signedIn(account)).send({ password: TEST_PASSWORD });
        assert.deepEqual(await knex('account_tokens').where({ account_id: account.id }), []);
    });
});
