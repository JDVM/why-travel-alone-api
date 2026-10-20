const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { api, knex, createAccount, bearer, validTrip } = require('./helpers');

async function tripWithOwner() {
    const owner = await createAccount();
    const res = await api().post('/trips/new').set(bearer(owner)).send(validTrip());
    return { owner, tripId: res.body.trip };
}

const linkCount = async (tripId, userId) =>
    Number((await knex('user_trips').where({ trip_id: tripId, user_id: userId }).count({ n: '*' }).first()).n);

describe('traveler directory', () => {
    it('lists travelers with their preferred destinations', async () => {
        const res = await api().get('/travelers');
        assert.equal(res.status, 200);
        assert.ok(res.body.length > 0);
        assert.ok('preferred_destinations' in res.body[0]);
    });

    it('returns one traveler, or 404 for an invalid or unknown id', async () => {
        assert.equal((await api().get('/travelers/1')).status, 200);
        assert.equal((await api().get('/travelers/abc')).status, 404);
        assert.equal((await api().get('/travelers/999999')).status, 404);
    });
});

describe('adding travelers to a trip', () => {
    it('requires a login', async () => {
        assert.equal((await api().post('/travelers/addto').send({ user_id: 1, trip_id: 1 })).status, 401);
    });

    it('adds a traveler to your own trip once, and rejects a duplicate with 409', async () => {
        const { owner, tripId } = await tripWithOwner();
        const add = () => api().post('/travelers/addto').set(bearer(owner)).send({ user_id: 7, trip_id: tripId });

        assert.equal((await add()).status, 201);
        assert.equal((await add()).status, 409);
        assert.equal(await linkCount(tripId, 7), 1);
    });

    it('returns 404 for an unknown traveler or trip, and 400 for invalid ids', async () => {
        const { owner, tripId } = await tripWithOwner();
        const add = (body) => api().post('/travelers/addto').set(bearer(owner)).send(body);

        assert.equal((await add({ user_id: 999999, trip_id: tripId })).status, 404);
        assert.equal((await add({ user_id: 7, trip_id: 999999 })).status, 404);
        assert.equal((await add({ user_id: 'x', trip_id: tripId })).status, 400);
    });

    it("can't add a traveler to another account's trip", async () => {
        const { tripId } = await tripWithOwner();
        const other = await createAccount();

        const res = await api().post('/travelers/addto').set(bearer(other)).send({ user_id: 8, trip_id: tripId });
        assert.equal(res.status, 404);
        assert.equal(await linkCount(tripId, 8), 0);
    });
});

describe('removing travelers from a trip', () => {
    it("can't remove a traveler from another account's trip", async () => {
        const { owner, tripId } = await tripWithOwner();
        await api().post('/travelers/addto').set(bearer(owner)).send({ user_id: 9, trip_id: tripId });
        const other = await createAccount();

        assert.equal((await api().delete(`/travelers/${tripId}/9`).set(bearer(other))).status, 404);
        assert.equal(await linkCount(tripId, 9), 1);
    });

    it('removes a traveler from your own trip, then 404s when they are no longer on it', async () => {
        const { owner, tripId } = await tripWithOwner();
        await api().post('/travelers/addto').set(bearer(owner)).send({ user_id: 10, trip_id: tripId });

        assert.equal((await api().delete(`/travelers/${tripId}/10`).set(bearer(owner))).status, 204);
        assert.equal(await linkCount(tripId, 10), 0);
        assert.equal((await api().delete(`/travelers/${tripId}/10`).set(bearer(owner))).status, 404);
    });
});
