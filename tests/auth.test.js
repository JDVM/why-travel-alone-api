const crypto = require('crypto');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { api, knex, DEMO, createAccount, bearer } = require('./helpers');

const uniqueEmail = () => `auth-${crypto.randomUUID()}@example.com`;

describe('register', () => {
    it('creates an account, returns a token, and stores the email normalized', async () => {
        const email = uniqueEmail();
        const res = await api().post('/auth/register').send({ email: `  ${email.toUpperCase()} `, password: 'a-good-password' });
        assert.equal(res.status, 201);
        assert.ok(res.body.token);
        assert.equal(res.body.account.email, email);

        const me = await api().get('/auth/me').set('Authorization', `Bearer ${res.body.token}`);
        assert.equal(me.status, 200);
        assert.equal(me.body.email, email);
    });

    it('rejects a duplicate email with 409', async () => {
        const res = await api().post('/auth/register').send({ email: DEMO.email, password: 'a-good-password' });
        assert.equal(res.status, 409);
    });

    it('rejects invalid emails and passwords with 400', async () => {
        const cases = [
            { email: 'not-an-email', password: 'a-good-password' },
            { email: uniqueEmail(), password: 'short' },
            { email: uniqueEmail(), password: 'p'.repeat(73) },
            { email: uniqueEmail() },
        ];
        for (const body of cases) {
            const res = await api().post('/auth/register').send(body);
            assert.equal(res.status, 400, JSON.stringify(body));
        }
    });
});

describe('login', () => {
    it('logs in the seeded demo account', async () => {
        const res = await api().post('/auth/login').send({ email: DEMO.email, password: DEMO.password });
        assert.equal(res.status, 200);
        assert.equal(res.body.account.id, DEMO.id);
        assert.ok(res.body.token);
    });

    it('gives the same 401 for a wrong password and an unknown email', async () => {
        const wrong = await api().post('/auth/login').send({ email: DEMO.email, password: 'wrong-password' });
        const unknown = await api().post('/auth/login').send({ email: uniqueEmail(), password: 'wrong-password' });
        assert.equal(wrong.status, 401);
        assert.equal(unknown.status, 401);
        assert.deepEqual(wrong.body, unknown.body);
    });

    it('rejects a missing email or password with 400', async () => {
        assert.equal((await api().post('/auth/login').send({ email: DEMO.email })).status, 400);
        assert.equal((await api().post('/auth/login').send({ email: 5, password: 'x' })).status, 400);
    });

    it("doesn't let a different password sharing the first 72 bytes log in", async () => {
        const email = uniqueEmail();
        const password = 'p'.repeat(72);
        assert.equal((await api().post('/auth/register').send({ email, password })).status, 201);

        assert.equal((await api().post('/auth/login').send({ email, password: `${password}EXTRA` })).status, 401);
        assert.equal((await api().post('/auth/login').send({ email, password })).status, 200);
    });

    it('re-hashes an older, lower-cost password hash on successful login', async () => {
        const email = uniqueEmail();
        await knex('accounts').insert({ email, password_hash: bcrypt.hashSync('old-password', 4), auth_provider: 'local' });

        const res = await api().post('/auth/login').send({ email, password: 'old-password' });
        assert.equal(res.status, 200);
        const { password_hash } = await knex('accounts').where({ email }).first('password_hash');
        assert.equal(bcrypt.getRounds(password_hash), 12);
    });
});

describe('tokens', () => {
    const secret = () => process.env.JWT_SECRET;

    it('rejects requests without a valid bearer token', async () => {
        assert.equal((await api().get('/auth/me')).status, 401);
        assert.equal((await api().get('/auth/me').set('Authorization', 'Token abc')).status, 401);
        assert.equal((await api().get('/auth/me').set('Authorization', 'Bearer not-a-jwt')).status, 401);
    });

    it('rejects an expired token', async () => {
        const account = await createAccount();
        const expired = jwt.sign(
            { accountId: account.id, email: account.email, exp: Math.floor(Date.now() / 1000) - 60 },
            secret(),
            { algorithm: 'HS256' }
        );
        assert.equal((await api().get('/auth/me').set('Authorization', `Bearer ${expired}`)).status, 401);
    });

    it('rejects a token signed with another algorithm, even with the real secret', async () => {
        const account = await createAccount();
        const hs512 = jwt.sign({ accountId: account.id, email: account.email }, secret(), { algorithm: 'HS512' });
        assert.equal((await api().get('/auth/me').set('Authorization', `Bearer ${hs512}`)).status, 401);
        assert.equal((await api().get('/auth/me').set(bearer(account))).status, 200);
    });

    it('rejects a token signed with a different secret', async () => {
        const forged = jwt.sign({ accountId: DEMO.id, email: DEMO.email }, 'x'.repeat(48), { algorithm: 'HS256' });
        assert.equal((await api().get('/auth/me').set('Authorization', `Bearer ${forged}`)).status, 401);
    });
});

describe('rate limiting', () => {
    it('blocks the 11th failed login in 15 minutes, and successful logins never count', async () => {
        const app = api();
        for (let i = 0; i < 12; i++) {
            const ok = await app.post('/auth/login').send({ email: DEMO.email, password: DEMO.password });
            assert.equal(ok.status, 200, `successful login ${i + 1}`);
        }
        for (let i = 0; i < 10; i++) {
            const failed = await app.post('/auth/login').send({ email: DEMO.email, password: 'guess' });
            assert.equal(failed.status, 401, `failed login ${i + 1}`);
        }
        const blocked = await app.post('/auth/login').send({ email: DEMO.email, password: 'guess' });
        assert.equal(blocked.status, 429);
        assert.match(blocked.body.error, /Too many attempts/);
    });

    it('blocks the 11th registration attempt in an hour', async () => {
        const app = api();
        for (let i = 0; i < 10; i++) {
            assert.equal((await app.post('/auth/register').send({ email: 'bad', password: 'x' })).status, 400);
        }
        assert.equal((await app.post('/auth/register').send({ email: 'bad', password: 'x' })).status, 429);
    });
});
