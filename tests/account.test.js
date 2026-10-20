const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { api, knex, TEST_PASSWORD, createAccount, bearer, validTrip } = require('./helpers');

// owner owns a trip that member has joined; member owns a trip of their own
// and has a pending invitation to a third trip.
async function setup() {
    const owner = await createAccount();
    const member = await createAccount();
    const other = await createAccount();

    const sharedTrip = (await api().post('/trips/new').set(bearer(owner)).send(validTrip({ trip_name: 'Shared trip' })))
        .body.trip;
    await api().post(`/trips/${sharedTrip}/invitations`).set(bearer(owner)).send({ user_id: member.travelerId });
    const [invitation] = (await api().get('/invitations').set(bearer(member))).body;
    await api().post(`/invitations/${invitation.invitation_id}/accept`).set(bearer(member));

    const ownTrip = (await api().post('/trips/new').set(bearer(member)).send(validTrip({ trip_name: 'Own trip' }))).body
        .trip;
    const pendingTrip = (await api().post('/trips/new').set(bearer(other)).send(validTrip({ trip_name: 'Pending trip' })))
        .body.trip;
    await api().post(`/trips/${pendingTrip}/invitations`).set(bearer(other)).send({ user_id: member.travelerId });

    return { owner, member, other, sharedTrip, ownTrip, pendingTrip };
}

describe('data export', () => {
    it('requires a login', async () => {
        assert.equal((await api().get('/account/export')).status, 401);
    });

    it("downloads the caller's own data and nothing private about anyone else", async () => {
        const { owner, member, ownTrip, sharedTrip } = await setup();
        await api().post(`/trips/${ownTrip}/invitations`).set(bearer(member)).send({ user_id: owner.travelerId });

        const res = await api().get('/account/export').set(bearer(member));
        assert.equal(res.status, 200);
        assert.match(res.headers['content-disposition'], /attachment; filename="why-travel-alone-data-\d{4}-\d{2}-\d{2}\.json"/);
        assert.equal(res.headers['cache-control'], 'no-store');

        const data = res.body;
        assert.equal(data.account.id, member.id);
        assert.equal(data.account.email, member.email);
        assert.ok(data.account.terms_accepted_at);
        assert.equal('password_hash' in data.account, false);

        assert.equal(data.profile.traveler_id, member.travelerId);
        assert.equal(data.profile.has_kids, true);
        assert.equal(data.profile.special_considerations, 'Private note');
        assert.ok(data.profile.special_considerations_consent_at);
        assert.deepEqual(data.profile.preferred_destinations, []);

        assert.deepEqual(data.trips_owned.map((trip) => [trip.trip_id, trip.trip_name, trip.kid_friendly]), [
            [ownTrip, 'Own trip', false],
        ]);
        assert.deepEqual(data.trips_joined.map((trip) => [trip.trip_id, trip.owner]), [
            [sharedTrip, `Test Traveler ${owner.id}`],
        ]);
        assert.deepEqual(data.invitations_received.map((i) => [i.trip_name, i.status]).sort(), [
            ['Pending trip', 'pending'],
            ['Shared trip', 'accepted'],
        ]);
        assert.deepEqual(data.invitations_sent.map((i) => [i.trip_name, i.invitee, i.status]), [
            ['Own trip', `Test Traveler ${owner.id}`, 'pending'],
        ]);

        // Other people appear only by name: none of their private details.
        assert.equal(JSON.stringify(data).match(/Private note/g).length, 1);
        assert.ok(!JSON.stringify(data).includes(owner.email));
    });

    it('works for an older account without a traveler profile', async () => {
        const legacy = await createAccount({ profile: false });
        const res = await api().get('/account/export').set(bearer(legacy));
        assert.equal(res.status, 200);
        assert.equal(res.body.profile, null);
        assert.deepEqual(res.body.trips_joined, []);
    });
});

describe('account deletion', () => {
    it('requires a login and the password', async () => {
        const account = await createAccount();
        assert.equal((await api().delete('/account').send({ password: TEST_PASSWORD })).status, 401);
        assert.equal((await api().delete('/account').set(bearer(account)).send({})).status, 400);

        const wrong = await api().delete('/account').set(bearer(account)).send({ password: 'not-the-password' });
        assert.equal(wrong.status, 403);
        assert.ok(await knex('accounts').where('id', account.id).first());
    });

    it('deletes the account, its profile, its trips and its memberships, and leaves other trips alone', async () => {
        const { owner, member, sharedTrip, ownTrip, pendingTrip } = await setup();

        const res = await api().delete('/account').set(bearer(member)).send({ password: TEST_PASSWORD });
        assert.equal(res.status, 204);

        assert.equal(await knex('accounts').where('id', member.id).first(), undefined);
        assert.equal(await knex('users').where('id', member.travelerId).first(), undefined);
        assert.equal(await knex('trips').where('id', ownTrip).first(), undefined);
        assert.deepEqual(await knex('user_trips').where('user_id', member.travelerId), []);
        assert.deepEqual(await knex('trip_invitations').where('user_id', member.travelerId), []);

        // The trips they had joined or been invited to still exist, without them.
        const shared = (await api().get(`/trips/${sharedTrip}`).set(bearer(owner))).body;
        assert.deepEqual(shared.users.map((user) => user.user_id), [owner.travelerId]);
        assert.ok(await knex('trips').where('id', pendingTrip).first());

        // Their token stops working at once, and they can't log in again.
        assert.equal((await api().get('/auth/me').set(bearer(member))).status, 401);
        assert.equal((await api().get('/travelers').set(bearer(member))).status, 401);
        const login = await api().post('/auth/login').send({ email: member.email, password: TEST_PASSWORD });
        assert.equal(login.status, 401);
    });

    it('limits wrong-password attempts', async () => {
        const account = await createAccount();
        const app = api();
        for (let i = 0; i < 10; i += 1) {
            assert.equal((await app.delete('/account').set(bearer(account)).send({ password: 'wrong-password' })).status, 403);
        }
        assert.equal((await app.delete('/account').set(bearer(account)).send({ password: TEST_PASSWORD })).status, 429);
    });
});
