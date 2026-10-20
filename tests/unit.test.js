// Pure functions: no database or server needed.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { configErrors, corsOrigins, trustProxy } = require('../config');
const { parseId, validateTripInput, newPasswordError, isValidEmail, normalizeEmail } = require('../utils/validate');

const goodEnv = { JWT_SECRET: 'x'.repeat(32), DB_LOCAL_DBNAME: 'db', DB_LOCAL_USER: 'user' };

describe('configErrors', () => {
    it('accepts a complete development environment', () => {
        assert.deepEqual(configErrors(goodEnv), []);
    });

    it('requires a JWT_SECRET of at least 32 characters', () => {
        assert.match(configErrors({ ...goodEnv, JWT_SECRET: undefined })[0], /JWT_SECRET/);
        assert.match(configErrors({ ...goodEnv, JWT_SECRET: 'x'.repeat(31) })[0], /JWT_SECRET/);
    });

    it('requires CORS_ORIGIN in production only', () => {
        assert.match(configErrors({ ...goodEnv, NODE_ENV: 'production' })[0], /CORS_ORIGIN/);
        assert.deepEqual(configErrors({ ...goodEnv, NODE_ENV: 'production', CORS_ORIGIN: 'https://a.example' }), []);
    });

    it('requires the database name and user', () => {
        const errors = configErrors({ JWT_SECRET: 'x'.repeat(32) });
        assert.equal(errors.length, 2);
    });
});

describe('corsOrigins', () => {
    it('defaults to the local frontend', () => {
        assert.deepEqual(corsOrigins({}), ['http://localhost:3000']);
    });

    it('splits and trims a comma-separated list', () => {
        assert.deepEqual(corsOrigins({ CORS_ORIGIN: 'https://a.example, https://b.example ,' }), [
            'https://a.example',
            'https://b.example',
        ]);
    });
});

describe('trustProxy', () => {
    it('is unset by default, numeric for hop counts, and passes other values through', () => {
        assert.equal(trustProxy({}), undefined);
        assert.equal(trustProxy({ TRUST_PROXY: '1' }), 1);
        assert.equal(trustProxy({ TRUST_PROXY: 'loopback' }), 'loopback');
    });
});

describe('parseId', () => {
    it('accepts positive integers as numbers or digit strings', () => {
        assert.equal(parseId(7), 7);
        assert.equal(parseId('42'), 42);
    });

    it('rejects everything else', () => {
        for (const value of ['0', 0, '-1', -1, 'abc', '1.5', 1.5, '01', '', null, undefined, {}, '1 OR 1=1']) {
            assert.equal(parseId(value), null, `parseId(${JSON.stringify(value)})`);
        }
    });
});

describe('validateTripInput', () => {
    const valid = { trip_name: ' Lisbon ', kid_friendly: 'true', trip_length: '0', destination_id: '3', notes: '' };

    it('normalizes a valid trip', () => {
        assert.deepEqual(validateTripInput(valid).trip, {
            trip_name: 'Lisbon',
            kid_friendly: true,
            trip_length: 0,
            destination_id: 3,
            notes: null,
        });
    });

    const invalid = {
        'missing name': { trip_name: '' },
        'name as an object': { trip_name: { a: 1 } },
        'name over 255 characters': { trip_name: 'x'.repeat(256) },
        'kid_friendly not a boolean': { kid_friendly: 'yes' },
        'missing kid_friendly': { kid_friendly: undefined },
        'fractional length': { trip_length: 2.5 },
        'negative length': { trip_length: -1 },
        'length over 365': { trip_length: 366 },
        'non-numeric length': { trip_length: 'abc' },
        'missing destination': { destination_id: undefined },
        'destination 0': { destination_id: 0 },
        'notes as a number': { notes: 5 },
        'notes over 255 characters': { notes: 'x'.repeat(256) },
    };
    for (const [name, overrides] of Object.entries(invalid)) {
        it(`rejects ${name}`, () => {
            const result = validateTripInput({ ...valid, ...overrides });
            assert.equal(result.trip, undefined);
            assert.equal(typeof result.error, 'string');
        });
    }
});

describe('password and email checks', () => {
    it('requires 8 characters and at most 72 bytes', () => {
        assert.match(newPasswordError('short'), /at least 8/);
        assert.equal(newPasswordError('p'.repeat(72)), null);
        assert.match(newPasswordError('p'.repeat(73)), /at most 72/);
        // 37 accented characters are 74 bytes in UTF-8.
        assert.match(newPasswordError('é'.repeat(37)), /at most 72/);
        assert.match(newPasswordError(undefined), /at least 8/);
    });

    it('normalizes and validates emails', () => {
        assert.equal(normalizeEmail('  Demo@Example.COM '), 'demo@example.com');
        assert.equal(isValidEmail('demo@example.com'), true);
        assert.equal(isValidEmail('not-an-email'), false);
        assert.equal(isValidEmail(`${'a'.repeat(250)}@b.co`), false);
    });
});
