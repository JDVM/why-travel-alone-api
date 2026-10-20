const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { api, createAccount, bearer, validTrip } = require('./helpers');

const fullProfile = (overrides = {}) => ({
    first_name: 'Rosa',
    last_name: 'Diaz',
    has_kids: true,
    type_of_travel_id: 2,
    special_considerations: 'Vegetarian',
    preferred_destination_ids: [3, 1, 3],
    ...overrides,
});

describe('profile', () => {
    it('requires a login', async () => {
        assert.equal((await api().get('/profile')).status, 401);
        assert.equal((await api().put('/profile').send(fullProfile())).status, 401);
    });

    it('returns your whole profile, including private fields', async () => {
        const account = await createAccount();
        const res = await api().get('/profile').set(bearer(account));
        assert.equal(res.status, 200);
        assert.equal(res.body.user_id, account.travelerId);
        assert.equal(res.body.special_considerations, 'Private note');
        assert.deepEqual(res.body.preferred_destinations, []);
    });

    it('replaces the profile, de-duplicating preferred destinations', async () => {
        const account = await createAccount();
        const res = await api().put('/profile').set(bearer(account)).send(fullProfile());
        assert.equal(res.status, 200);
        assert.equal(res.body.first_name, 'Rosa');
        assert.equal(res.body.has_kids, 1);
        assert.equal(res.body.type_of_travel_id, 2);
        assert.ok(res.body.type_of_travel);
        assert.deepEqual(res.body.preferred_destinations.map((d) => d.id).sort(), [1, 3]);

        // Omitted optional fields are cleared.
        const cleared = await api().put('/profile').set(bearer(account)).send({ first_name: 'Rosa', last_name: 'Diaz' });
        assert.equal(cleared.body.has_kids, 0);
        assert.equal(cleared.body.type_of_travel_id, null);
        assert.equal(cleared.body.special_considerations, null);
        assert.deepEqual(cleared.body.preferred_destinations, []);
    });

    it('rejects invalid input with 400', async () => {
        const account = await createAccount();
        const cases = [
            { first_name: '' },
            { last_name: undefined },
            { has_kids: 'yes' },
            { type_of_travel_id: 'fast' },
            { type_of_travel_id: 999999 },
            { special_considerations: 'x'.repeat(51) },
            { preferred_destination_ids: 'Paris' },
            { preferred_destination_ids: [1, 999999] },
            { preferred_destination_ids: Array.from({ length: 21 }, (_, i) => i + 1) },
        ];
        for (const overrides of cases) {
            const res = await api().put('/profile').set(bearer(account)).send(fullProfile(overrides));
            assert.equal(res.status, 400, JSON.stringify(overrides));
        }
    });

    it('creates a profile for an older account that has none, which can then plan trips', async () => {
        const legacy = await createAccount({ profile: false });
        assert.equal((await api().get('/profile').set(bearer(legacy))).status, 404);

        const res = await api().put('/profile').set(bearer(legacy)).send(fullProfile());
        assert.equal(res.status, 200);
        assert.equal((await api().post('/trips/new').set(bearer(legacy)).send(validTrip())).status, 201);

        const me = (await api().get('/auth/me').set(bearer(legacy))).body;
        assert.equal(me.traveler.user_id, res.body.user_id);
    });
});

describe('travel types', () => {
    it('lists the travel types', async () => {
        const res = await api().get('/types-of-travel');
        assert.equal(res.status, 200);
        assert.ok(res.body.length > 0);
        assert.deepEqual(Object.keys(res.body[0]).sort(), ['id', 'type_of_travel']);
    });
});
