const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { api, knex, DEMO, createAccount, signedIn, demoSession, validTrip } = require('./helpers');

async function createTrip(account, overrides) {
    const res = await api().post('/trips/new').set(signedIn(account)).send(validTrip(overrides));
    assert.equal(res.status, 201);
    return res.body.trip;
}

describe('listing and reading trips', () => {
    it('requires a login', async () => {
        assert.equal((await api().get('/trips')).status, 401);
        assert.equal((await api().get('/trips/1')).status, 401);
    });

    it('lists the trips the caller owns or is on, and nothing else', async () => {
        const res = await api().get('/trips').set(await demoSession());
        assert.equal(res.status, 200);
        const expected = await knex('trips')
            .where('owner_id', DEMO.id)
            .orWhereIn('id', knex('user_trips').where('user_id', 1).select('trip_id'))
            .count({ n: '*' })
            .first();
        assert.equal(res.body.length, Number(expected.n));
        assert.ok(res.body.every((trip) => trip.is_owner === 1));

        const newcomer = await createAccount();
        assert.deepEqual((await api().get('/trips').set(signedIn(newcomer))).body, []);
    });

    it('returns a trip with destination_id, destination and travelers', async () => {
        const res = await api().get('/trips/1').set(await demoSession());
        assert.equal(res.status, 200);
        assert.equal(res.body.trip_id, 1);
        assert.equal(typeof res.body.destination_id, 'number');
        assert.equal(typeof res.body.destination, 'string');
        assert.ok(Array.isArray(res.body.users));
    });

    it('returns 404 for invalid or unknown ids', async () => {
        assert.equal((await api().get('/trips/abc').set(await demoSession())).status, 404);
        assert.equal((await api().get('/trips/999999').set(await demoSession())).status, 404);
    });
});

describe('creating and updating trips', () => {
    it('creates a trip owned by the caller, with the owner as its first traveler', async () => {
        const account = await createAccount();
        const id = await createTrip(account, { trip_name: 'Day trip', trip_length: 0, kid_friendly: true });

        const trip = await knex('trips').where({ id }).first();
        assert.equal(trip.owner_id, account.id);
        assert.equal(trip.trip_length, 0);
        assert.equal(trip.kid_friendly, 1);

        const detail = await api().get(`/trips/${id}`).set(signedIn(account));
        assert.equal(detail.body.is_owner, true);
        assert.deepEqual(detail.body.users.map((user) => user.user_id), [account.travelerId]);
        assert.deepEqual(detail.body.invitations, []);
    });

    it('asks an account without a traveler profile to create one first', async () => {
        const legacy = await createAccount({ profile: false });
        const res = await api().post('/trips/new').set(signedIn(legacy)).send(validTrip());
        assert.equal(res.status, 400);
        assert.match(res.body.error, /profile/);
    });

    it('accepts the string values a form submits', async () => {
        const account = await createAccount();
        await createTrip(account, { kid_friendly: 'false', trip_length: '7', destination_id: '2', notes: '' });
    });

    it('rejects invalid input with 400', async () => {
        const account = await createAccount();
        const cases = [
            { trip_name: '' },
            { trip_name: 'x'.repeat(256) },
            { notes: 'x'.repeat(256) },
            { trip_length: 2.5 },
            { trip_length: 'abc' },
            { kid_friendly: 'maybe' },
            { destination_id: 'one' },
            { destination_id: 999999 },
        ];
        for (const overrides of cases) {
            const res = await api().post('/trips/new').set(signedIn(account)).send(validTrip(overrides));
            assert.equal(res.status, 400, JSON.stringify(overrides));
            assert.equal(typeof res.body.error, 'string');
        }
    });

    it('updates a trip the caller owns', async () => {
        const account = await createAccount();
        const id = await createTrip(account);

        const res = await api().put(`/trips/${id}`).set(signedIn(account)).send(validTrip({ trip_name: 'Renamed', notes: undefined }));
        assert.equal(res.status, 200);
        const trip = await knex('trips').where({ id }).first();
        assert.equal(trip.trip_name, 'Renamed');
        assert.equal(trip.notes, null);
    });
});

describe('ownership', () => {
    it("returns 404 for another account's trip on read, update and delete, and changes nothing", async () => {
        const owner = await createAccount();
        const other = await createAccount();
        const id = await createTrip(owner, { trip_name: 'Private trip' });

        assert.equal((await api().get(`/trips/${id}`).set(signedIn(other))).status, 404);
        assert.equal((await api().put(`/trips/${id}`).set(signedIn(other)).send(validTrip({ trip_name: 'Hijacked' }))).status, 404);
        assert.equal((await api().delete(`/trips/${id}`).set(signedIn(other))).status, 404);

        const trip = await knex('trips').where({ id }).first();
        assert.equal(trip.trip_name, 'Private trip');
    });
});

describe('deleting trips', () => {
    it('deletes the trip and its traveler links', async () => {
        const account = await createAccount();
        const id = await createTrip(account);
        await knex('user_trips').insert([{ user_id: 5, trip_id: id }, { user_id: 6, trip_id: id }]);

        assert.equal((await api().delete(`/trips/${id}`).set(signedIn(account))).status, 204);
        assert.equal(await knex('trips').where({ id }).first(), undefined);
        const links = await knex('user_trips').where({ trip_id: id }).count({ n: '*' }).first();
        assert.equal(Number(links.n), 0);
    });

    it('returns 404 for a trip that no longer exists', async () => {
        const account = await createAccount();
        const id = await createTrip(account);
        await api().delete(`/trips/${id}`).set(signedIn(account));
        assert.equal((await api().delete(`/trips/${id}`).set(signedIn(account))).status, 404);
    });
});

describe('schema', () => {
    it('enforces the user_trips foreign key and one row per traveler per trip', async () => {
        const [rows] = await knex.raw('SHOW CREATE TABLE user_trips');
        const ddl = rows[0]['Create Table'];
        assert.match(ddl, /FOREIGN KEY \(`trip_id`\) REFERENCES `trips` \(`id`\) ON DELETE CASCADE/);
        assert.match(ddl, /UNIQUE KEY `user_trips_user_id_trip_id_unique` \(`user_id`,`trip_id`\)/);
    });
});
