const crypto = require('crypto');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { api, knex, DEMO, ORIGIN, createAccount, signedIn, sessionFrom } = require('./helpers');
const { COOKIE_NAME, hashId } = require('../utils/sessions');
const { TERMS_VERSION } = require('../config');

const uniqueEmail = () => `auth-${crypto.randomUUID()}@example.com`;
// The rest of a valid signup besides email and password.
const names = { first_name: 'Ana', last_name: 'Lima', accept_terms: true };

describe('register', () => {
    it('creates an account and its traveler profile, and stores the email normalized', async () => {
        const email = uniqueEmail();
        const res = await api()
            .post('/auth/register')
            .send({
                email: `  ${email.toUpperCase()} `,
                password: 'a-good-password',
                first_name: ' Ana ',
                last_name: 'Lima',
                accept_terms: true,
            });
        assert.equal(res.status, 201);
        assert.equal(res.body.token, undefined);
        assert.equal(res.body.account.email, email);
        assert.equal(res.body.account.traveler.first_name, 'Ana');

        const me = await api().get('/auth/me').set(sessionFrom(res));
        assert.equal(me.status, 200);
        assert.equal(me.body.email, email);
        assert.deepEqual(me.body.traveler, res.body.account.traveler);

        const traveler = await knex('users').where({ account_id: res.body.account.id }).first();
        assert.equal(traveler.last_name, 'Lima');
        assert.equal(traveler.type_of_travel_id, null);
        assert.equal(traveler.has_kids, 0);
    });

    it('rejects a duplicate email with 409', async () => {
        const res = await api().post('/auth/register').send({ email: DEMO.email, password: 'a-good-password', ...names });
        assert.equal(res.status, 409);
    });

    it('rejects invalid emails, passwords and names with 400', async () => {
        const cases = [
            { email: 'not-an-email', password: 'a-good-password', ...names },
            { email: uniqueEmail(), password: 'short', ...names },
            { email: uniqueEmail(), password: 'p'.repeat(73), ...names },
            { email: uniqueEmail(), ...names },
            { email: uniqueEmail(), password: 'a-good-password', last_name: 'Lima' },
            { email: uniqueEmail(), password: 'a-good-password', first_name: 'Ana', last_name: ' ' },
            { email: uniqueEmail(), password: 'a-good-password', first_name: 'x'.repeat(256), last_name: 'Lima' },
        ];
        for (const body of cases) {
            const res = await api().post('/auth/register').send(body);
            assert.equal(res.status, 400, JSON.stringify(body));
        }
    });

    it('requires accepting the terms, and records which version was accepted', async () => {
        for (const accept_terms of [undefined, false, 'true']) {
            const email = uniqueEmail();
            const res = await api()
                .post('/auth/register')
                .send({ email, password: 'a-good-password', ...names, accept_terms });
            assert.equal(res.status, 400, String(accept_terms));
            assert.match(res.body.error, /terms/);
            assert.equal(await knex('accounts').where({ email }).first(), undefined);
        }

        const email = uniqueEmail();
        const before = Date.now() - 1000;
        assert.equal((await api().post('/auth/register').send({ email, password: 'a-good-password', ...names })).status, 201);
        const account = await knex('accounts').where({ email }).first();
        assert.equal(account.terms_version, TERMS_VERSION);
        assert.ok(new Date(account.terms_accepted_at).getTime() >= before);
    });

    it('creates no account when the profile is invalid', async () => {
        const email = uniqueEmail();
        await api().post('/auth/register').send({ email, password: 'a-good-password', first_name: 'Ana' });
        assert.equal(await knex('accounts').where({ email }).first(), undefined);
    });
});

describe('login', () => {
    it('logs in the seeded demo account, who is traveler 1', async () => {
        const res = await api().post('/auth/login').send({ email: DEMO.email, password: DEMO.password });
        assert.equal(res.status, 200);
        assert.equal(res.body.account.id, DEMO.id);
        assert.equal(res.body.account.traveler.user_id, 1);
        assert.equal((await api().get('/auth/me').set(sessionFrom(res))).body.id, DEMO.id);
    });

    it('logs in a seeded traveler with their own login', async () => {
        const res = await api().post('/auth/login').send({ email: 'traveler7@why-travel-alone.local', password: DEMO.password });
        assert.equal(res.status, 200);
        assert.equal(res.body.account.traveler.user_id, 7);
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
        assert.equal((await api().post('/auth/register').send({ email, password, ...names })).status, 201);

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

describe('sessions', () => {
    const cookieFor = (value) => ({ Cookie: `${COOKIE_NAME}=${value}`, Origin: ORIGIN });

    it('logs in with an httpOnly, Secure, SameSite cookie, and stores only its hash', async () => {
        const res = await api().post('/auth/login').send({ email: DEMO.email, password: DEMO.password });
        const setCookie = res.headers['set-cookie'].find((c) => c.startsWith(`${COOKIE_NAME}=`));
        assert.match(setCookie, /HttpOnly/);
        assert.match(setCookie, /Secure/);
        assert.match(setCookie, /SameSite=Lax/);
        assert.match(setCookie, /Path=\//);
        assert.match(setCookie, /Max-Age=2592000/);

        const value = setCookie.split(';')[0].split('=')[1];
        assert.equal(await knex('sessions').where({ id: value }).first(), undefined);
        assert.ok(await knex('sessions').where({ id: hashId(value) }).first());
    });

    it('rejects requests without a live session', async () => {
        assert.equal((await api().get('/auth/me')).status, 401);
        assert.equal((await api().get('/auth/me').set(cookieFor('garbage'))).status, 401);
        assert.equal((await api().get('/auth/me').set(cookieFor('x'.repeat(43)))).status, 401);
        // A bearer token is no longer a way in.
        assert.equal((await api().get('/auth/me').set('Authorization', 'Bearer x')).status, 401);
    });

    it('ends sessions past their 30-day limit or unused for 14 days', async () => {
        const expired = await createAccount();
        await knex('sessions').where({ account_id: expired.id }).update({ expires_at: new Date(Date.now() - 1000) });
        assert.equal((await api().get('/auth/me').set(signedIn(expired))).status, 401);
        assert.deepEqual(await knex('sessions').where({ account_id: expired.id }), []);

        const idle = await createAccount();
        await knex('sessions')
            .where({ account_id: idle.id })
            .update({ last_seen_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) });
        assert.equal((await api().get('/auth/me').set(signedIn(idle))).status, 401);
    });

    it('logging out ends the session and clears the cookie', async () => {
        const account = await createAccount();
        const res = await api().post('/auth/logout').set(signedIn(account));
        assert.equal(res.status, 204);
        assert.match(res.headers['set-cookie'].join(), new RegExp(`${COOKIE_NAME}=;`));
        assert.equal((await api().get('/auth/me').set(signedIn(account))).status, 401);

        // Logging out without a session is harmless.
        assert.equal((await api().post('/auth/logout').set('Origin', ORIGIN)).status, 204);
    });

    it('lists signed-in devices and signs out all but this one', async () => {
        const account = await createAccount();
        const login = await api()
            .post('/auth/login')
            .set('User-Agent', 'Phone browser')
            .send({ email: account.email, password: 'test-password-123' });
        const phone = sessionFrom(login);

        const list = await api().get('/auth/sessions').set(signedIn(account));
        assert.equal(list.status, 200);
        assert.equal(list.body.length, 2);
        assert.deepEqual(list.body.filter((s) => s.current).map((s) => s.user_agent), ['tests']);
        assert.ok(list.body.some((s) => s.user_agent === 'Phone browser' && !s.current));
        assert.ok(list.body.every((s) => s.id.length === 16));

        const ended = await api().delete('/auth/sessions').set(signedIn(account));
        assert.deepEqual(ended.body, { ended: 1 });
        assert.equal((await api().get('/auth/me').set(phone)).status, 401);
        assert.equal((await api().get('/auth/me').set(signedIn(account))).status, 200);
    });

    it("refuses changes from other sites' pages", async () => {
        const account = await createAccount();
        const fromElsewhere = { ...signedIn(account), Origin: 'https://evil.example' };
        const update = (headers) => api().put('/profile').set(headers).send({ first_name: 'X', last_name: 'Y' });

        assert.equal((await update(fromElsewhere)).status, 403);
        const { Origin, ...noOrigin } = signedIn(account);
        assert.equal((await update(noOrigin)).status, 403);
        assert.equal((await update(signedIn(account))).status, 200);

        // Reading is fine from anywhere CORS lets through.
        assert.equal((await api().get('/auth/me').set(fromElsewhere)).status, 200);
        // So is a request with no session, e.g. an API client logging in.
        assert.equal((await api().post('/auth/login').send({ email: DEMO.email, password: DEMO.password })).status, 200);
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
