require('./env');
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { Writable } = require('node:stream');
const supertest = require('supertest');
const createApp = require('../app');
const { createLogger, emailTag } = require('../logger');
const { scrubEvent, initMonitoring } = require('../monitoring');
const { createAccount, bearer, DEMO } = require('./helpers');

// An app whose logs are captured as parsed JSON lines.
function loggedApp() {
    const lines = [];
    const stream = new Writable({
        write(chunk, encoding, done) {
            for (const line of chunk.toString().split('\n').filter(Boolean)) {
                lines.push(JSON.parse(line));
            }
            done();
        },
    });
    const logger = createLogger({ LOG_LEVEL: 'info' }, stream);
    return { request: supertest(createApp(process.env, { logger })), lines };
}

describe('request logging', () => {
    test('logs one line per request with the account id and no headers', async () => {
        const account = await createAccount();
        const { request, lines } = loggedApp();

        const res = await request.get('/trips').set(bearer(account));
        assert.equal(res.status, 200);

        const line = lines.find((l) => l.msg === 'request completed');
        assert.ok(line, 'access log line written');
        assert.equal(line.req.method, 'GET');
        assert.equal(line.req.url, '/trips');
        assert.equal(line.res.statusCode, 200);
        assert.equal(line.accountId, account.id);
        assert.equal(typeof line.responseTime, 'number');
        assert.ok(!JSON.stringify(lines).includes(account.token), 'token never logged');
    });

    test('gives every response a request id, reusing a well-formed incoming one', async () => {
        const { request, lines } = loggedApp();

        const fresh = await request.get('/types-of-travel');
        assert.match(fresh.headers['x-request-id'], /^[0-9a-f-]{36}$/);

        const forwarded = await request.get('/types-of-travel').set('X-Request-Id', 'lb-1234');
        assert.equal(forwarded.headers['x-request-id'], 'lb-1234');
        assert.ok(lines.some((l) => l.reqId === 'lb-1234'));

        const junk = await request.get('/types-of-travel').set('X-Request-Id', 'bad id with spaces');
        assert.notEqual(junk.headers['x-request-id'], 'bad id with spaces');
    });

    test('skips health checks', async () => {
        const { request, lines } = loggedApp();
        await request.get('/health');
        assert.equal(lines.length, 0);
    });

    test('logs 4xx responses as warnings', async () => {
        const { request, lines } = loggedApp();
        await request.get('/trips');
        const line = lines.find((l) => l.msg === 'request completed');
        assert.equal(line.res.statusCode, 401);
        assert.equal(line.level, 40);
    });
});

describe('auth events', () => {
    test('a failed login logs a hashed email, never the email or password', async () => {
        const { request, lines } = loggedApp();

        await request.post('/auth/login').send({ email: DEMO.email, password: 'wrong-password-xyz' });

        const event = lines.find((l) => l.event === 'auth.login_failed');
        assert.ok(event);
        assert.equal(event.emailTag, emailTag(DEMO.email));
        assert.equal(event.knownAccount, true);
        const logged = JSON.stringify(lines);
        assert.ok(!logged.includes(DEMO.email));
        assert.ok(!logged.includes('wrong-password-xyz'));
    });

    test('successful logins and registrations log the account id', async () => {
        const { request, lines } = loggedApp();

        const login = await request.post('/auth/login').send({ email: DEMO.email, password: DEMO.password });
        assert.equal(login.status, 200);
        assert.ok(lines.some((l) => l.event === 'auth.login' && l.accountId === DEMO.id));

        const email = `log-${Date.now()}@example.com`;
        const register = await request
            .post('/auth/register')
            .send({ email, password: 'a-good-password', first_name: 'Log', last_name: 'Test' });
        assert.equal(register.status, 201);
        assert.ok(lines.some((l) => l.event === 'auth.register' && l.accountId === register.body.account.id));
        assert.ok(!JSON.stringify(lines).includes(email));
    });

    test('hitting a rate limit is logged', async () => {
        const { request, lines } = loggedApp();
        for (let i = 0; i < 11; i += 1) {
            await request.post('/auth/login').send({ email: 'nobody@example.com', password: 'wrong-password' });
        }
        assert.ok(lines.some((l) => l.event === 'auth.rate_limited' && l.path === '/auth/login'));
    });

    test('email tags are stable, case-insensitive and keyed by the secret', () => {
        assert.equal(emailTag('A@Example.com'), emailTag('a@example.com'));
        assert.notEqual(emailTag('a@example.com'), emailTag('b@example.com'));
        assert.notEqual(
            emailTag('a@example.com', { JWT_SECRET: 'one-secret' }),
            emailTag('a@example.com', { JWT_SECRET: 'another-secret' })
        );
    });
});

describe('logger redaction', () => {
    test('redacts secrets even when a whole object is logged', () => {
        const lines = [];
        const stream = new Writable({
            write(chunk, encoding, done) {
                lines.push(chunk.toString());
                done();
            },
        });
        const logger = createLogger({ LOG_LEVEL: 'info' }, stream);
        logger.info({
            password: 'p1',
            body: { password: 'p2', token: 't1', new_password: 'p3' },
            account: { password_hash: 'h1' },
            req: { headers: { authorization: 'Bearer abc', cookie: 'c=1' } },
        });
        const out = lines.join('');
        for (const secret of ['p1', 'p2', 'p3', 't1', 'h1', 'Bearer abc', 'c=1']) {
            assert.ok(!out.includes(`"${secret}"`), `${secret} redacted`);
        }
    });

    test('is silent under test unless LOG_LEVEL says otherwise', () => {
        assert.equal(createLogger({ NODE_ENV: 'test' }).level, 'silent');
        assert.equal(createLogger({ NODE_ENV: 'production' }).level, 'info');
        assert.equal(createLogger({ NODE_ENV: 'production', LOG_LEVEL: 'debug' }).level, 'debug');
    });
});

describe('error reporting', () => {
    test('is off without SENTRY_DSN', () => {
        assert.equal(initMonitoring({}), false);
    });

    test('strips personal data from events', () => {
        const event = scrubEvent({
            request: {
                url: 'https://api.example.com/auth/reset-password?token=secret',
                query_string: 'token=secret',
                data: '{"password":"x"}',
                cookies: { a: 'b' },
                headers: { Authorization: 'Bearer abc', 'X-Forwarded-For': '1.2.3.4', 'User-Agent': 'test' },
            },
            user: { id: '7', email: 'a@example.com', ip_address: '1.2.3.4' },
        });
        assert.equal(event.request.url, 'https://api.example.com/auth/reset-password');
        assert.equal(event.request.query_string, undefined);
        assert.equal(event.request.data, undefined);
        assert.equal(event.request.cookies, undefined);
        assert.deepEqual(event.request.headers, { 'User-Agent': 'test' });
        assert.deepEqual(event.user, { id: '7' });
    });
});
