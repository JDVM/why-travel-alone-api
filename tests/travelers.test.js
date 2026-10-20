const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { api, createAccount, bearer, demoToken } = require('./helpers');

describe('traveler directory', () => {
    it('requires a login', async () => {
        assert.equal((await api().get('/travelers')).status, 401);
        assert.equal((await api().get('/travelers/1')).status, 401);
    });

    it('lists travelers with their public profile', async () => {
        const viewer = await createAccount();
        const res = await api().get('/travelers').set(bearer(viewer));
        assert.equal(res.status, 200);
        assert.ok(res.body.length > 0);
        const someone = res.body.find((traveler) => traveler.user_id === 7);
        assert.equal(someone.first_name.length > 0, true);
        assert.ok('type_of_travel' in someone);
        assert.ok(Array.isArray(someone.preferred_destinations) || typeof someone.preferred_destinations === 'string');
    });

    it("hides other travelers' private fields, in the list and one at a time", async () => {
        const viewer = await createAccount();
        const list = (await api().get('/travelers').set(bearer(viewer))).body;
        const others = list.filter((traveler) => traveler.user_id !== viewer.travelerId);
        assert.ok(others.length > 0);
        for (const traveler of others) {
            assert.equal('has_kids' in traveler, false, `traveler ${traveler.user_id}`);
            assert.equal('special_considerations' in traveler, false, `traveler ${traveler.user_id}`);
        }

        const one = (await api().get('/travelers/7').set(bearer(viewer))).body;
        assert.equal(one.user_id, 7);
        assert.equal('special_considerations' in one, false);
    });

    it('shows your own private fields', async () => {
        const viewer = await createAccount();
        const me = (await api().get(`/travelers/${viewer.travelerId}`).set(bearer(viewer))).body;
        assert.equal(me.special_considerations, 'Private note');
        assert.equal(me.has_kids, 1);
    });

    it('shows a trip owner the private fields of travelers on their trips', async () => {
        // Demo (traveler 1) owns trip 1, which seeded traveler 2 is on.
        const res = await api().get('/travelers/2').set(demoToken());
        assert.ok('special_considerations' in res.body);
    });

    it('returns 404 for an invalid or unknown id', async () => {
        const viewer = await createAccount();
        assert.equal((await api().get('/travelers/abc').set(bearer(viewer))).status, 404);
        assert.equal((await api().get('/travelers/999999').set(bearer(viewer))).status, 404);
    });

    it('no longer allows adding someone to a trip directly', async () => {
        const owner = await createAccount();
        const res = await api().post('/travelers/addto').set(bearer(owner)).send({ user_id: 7, trip_id: 1 });
        assert.equal(res.status, 404);
    });
});
