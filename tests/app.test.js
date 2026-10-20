// App-wide behavior: health, errors, body limits, headers, CORS.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { api } = require('./helpers');

describe('health and errors', () => {
    it('reports healthy when the database is reachable', async () => {
        const res = await api().get('/health');
        assert.equal(res.status, 200);
        assert.deepEqual(res.body, { status: 'ok' });
    });

    it('answers unknown routes with a JSON 404', async () => {
        const res = await api().get('/no-such-route');
        assert.equal(res.status, 404);
        assert.deepEqual(res.body, { error: 'Not found' });
    });

    it('answers malformed JSON with a 400 that leaks no internals', async () => {
        const res = await api()
            .post('/auth/login')
            .set('Content-Type', 'application/json')
            .send('{bad json');
        assert.equal(res.status, 400);
        assert.deepEqual(res.body, { error: 'Request body is not valid JSON' });
        assert.doesNotMatch(res.text, /node_modules|at JSON\.parse/);
    });

    it('rejects bodies over 10kb', async () => {
        const res = await api().post('/auth/login').send({ email: 'a@b.co', password: 'x'.repeat(11 * 1024) });
        assert.equal(res.status, 413);
    });
});

describe('security headers and CORS', () => {
    it('sets helmet headers and hides the framework', async () => {
        const res = await api().get('/health');
        assert.equal(res.headers['x-powered-by'], undefined);
        assert.ok(res.headers['content-security-policy']);
        assert.ok(res.headers['strict-transport-security']);
        assert.equal(res.headers['x-content-type-options'], 'nosniff');
    });

    it('allows only the configured origin', async () => {
        const env = { ...process.env, CORS_ORIGIN: 'https://app.example.com' };
        const allowed = await api(env).get('/health').set('Origin', 'https://app.example.com');
        assert.equal(allowed.headers['access-control-allow-origin'], 'https://app.example.com');

        const other = await api(env).get('/health').set('Origin', 'https://evil.example');
        assert.equal(other.headers['access-control-allow-origin'], undefined);
    });
});
