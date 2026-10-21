const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { api, knex, createAccount, signedIn, validTrip } = require('./helpers');

// An owner with a fresh trip, and a guest who isn't on it yet.
async function setup() {
    const owner = await createAccount();
    const guest = await createAccount();
    const res = await api().post('/trips/new').set(signedIn(owner)).send(validTrip({ trip_name: 'Invite test' }));
    return { owner, guest, tripId: res.body.trip };
}

const invite = (owner, tripId, userId) =>
    api().post(`/trips/${tripId}/invitations`).set(signedIn(owner)).send({ user_id: userId });

async function invitationIdFor(guest, tripId) {
    const list = (await api().get('/invitations').set(signedIn(guest))).body;
    const invitation = list.find((item) => item.trip_id === tripId);
    return invitation && invitation.invitation_id;
}

async function join(owner, guest, tripId) {
    assert.equal((await invite(owner, tripId, guest.travelerId)).status, 201);
    const id = await invitationIdFor(guest, tripId);
    assert.equal((await api().post(`/invitations/${id}/accept`).set(signedIn(guest))).status, 200);
}

describe('inviting and accepting', () => {
    it("doesn't show the trip to an invited traveler until they accept", async () => {
        const { owner, guest, tripId } = await setup();
        assert.equal((await invite(owner, tripId, guest.travelerId)).status, 201);

        const pending = (await api().get('/invitations').set(signedIn(guest))).body;
        assert.equal(pending.length, 1);
        assert.equal(pending[0].trip_name, 'Invite test');
        assert.equal(pending[0].owner_first_name, 'Test');

        assert.equal((await api().get(`/trips/${tripId}`).set(signedIn(guest))).status, 404);
        assert.deepEqual((await api().get('/trips').set(signedIn(guest))).body, []);

        const ownerView = (await api().get(`/trips/${tripId}`).set(signedIn(owner))).body;
        assert.deepEqual(
            ownerView.invitations.map(({ user_id, status }) => ({ user_id, status })),
            [{ user_id: guest.travelerId, status: 'pending' }]
        );
    });

    it('adds the traveler to the trip when they accept', async () => {
        const { owner, guest, tripId } = await setup();
        await join(owner, guest, tripId);

        const trips = (await api().get('/trips').set(signedIn(guest))).body;
        assert.deepEqual(trips.map((trip) => [trip.trip_id, trip.is_owner, trip.num_travelers]), [[tripId, 0, 2]]);
        assert.deepEqual((await api().get('/invitations').set(signedIn(guest))).body, []);

        const ownerView = (await api().get(`/trips/${tripId}`).set(signedIn(owner))).body;
        assert.deepEqual(ownerView.invitations, []);
    });

    it('shows members each other, with private fields only where allowed', async () => {
        const { owner, guest, tripId } = await setup();
        await join(owner, guest, tripId);

        const guestView = (await api().get(`/trips/${tripId}`).set(signedIn(guest))).body;
        assert.equal(guestView.is_owner, false);
        assert.equal(guestView.invitations, undefined);
        const ownerSeenByGuest = guestView.users.find((user) => user.user_id === owner.travelerId);
        const guestSeenByGuest = guestView.users.find((user) => user.user_id === guest.travelerId);
        assert.equal('special_considerations' in ownerSeenByGuest, false);
        assert.equal(guestSeenByGuest.special_considerations, 'Private note');

        // The owner of a trip the guest joined can see the guest's private fields.
        const ownerView = (await api().get(`/trips/${tripId}`).set(signedIn(owner))).body;
        assert.equal(ownerView.users.find((user) => user.user_id === guest.travelerId).special_considerations, 'Private note');
        const profile = (await api().get(`/travelers/${guest.travelerId}`).set(signedIn(owner))).body;
        assert.equal(profile.special_considerations, 'Private note');

        const stranger = await createAccount();
        const strangerView = (await api().get(`/travelers/${guest.travelerId}`).set(signedIn(stranger))).body;
        assert.equal('special_considerations' in strangerView, false);
    });

    it("doesn't let a member change the trip or invite people", async () => {
        const { owner, guest, tripId } = await setup();
        await join(owner, guest, tripId);
        const other = await createAccount();

        const asGuest = signedIn(guest);
        assert.equal((await api().put(`/trips/${tripId}`).set(asGuest).send(validTrip({ trip_name: 'Hijacked' }))).status, 403);
        assert.equal((await api().delete(`/trips/${tripId}`).set(asGuest)).status, 403);
        assert.equal((await invite(guest, tripId, other.travelerId)).status, 403);
        assert.equal((await api().delete(`/trips/${tripId}/travelers/${owner.travelerId}`).set(asGuest)).status, 403);

        const trip = await knex('trips').where({ id: tripId }).first();
        assert.equal(trip.trip_name, 'Invite test');
    });
});

describe('declining, leaving and removing', () => {
    it("records a decline, and the owner can't invite that traveler again", async () => {
        const { owner, guest, tripId } = await setup();
        await invite(owner, tripId, guest.travelerId);
        const id = await invitationIdFor(guest, tripId);

        assert.equal((await api().post(`/invitations/${id}/decline`).set(signedIn(guest))).status, 204);
        assert.equal((await api().get(`/trips/${tripId}`).set(signedIn(guest))).status, 404);

        const ownerView = (await api().get(`/trips/${tripId}`).set(signedIn(owner))).body;
        assert.equal(ownerView.invitations[0].status, 'declined');
        const again = await invite(owner, tripId, guest.travelerId);
        assert.equal(again.status, 409);
        assert.match(again.body.error, /declined/);
    });

    it("lets a member leave, after which they can't be invited again", async () => {
        const { owner, guest, tripId } = await setup();
        await join(owner, guest, tripId);

        assert.equal((await api().delete(`/trips/${tripId}/membership`).set(signedIn(guest))).status, 204);
        assert.equal((await api().get(`/trips/${tripId}`).set(signedIn(guest))).status, 404);
        assert.equal((await invite(owner, tripId, guest.travelerId)).status, 409);
    });

    it("doesn't let the owner leave or remove themselves", async () => {
        const { owner, tripId } = await setup();
        assert.equal((await api().delete(`/trips/${tripId}/membership`).set(signedIn(owner))).status, 400);
        assert.equal((await api().delete(`/trips/${tripId}/travelers/${owner.travelerId}`).set(signedIn(owner))).status, 400);
    });

    it('lets the owner remove a member, and invite them again later', async () => {
        const { owner, guest, tripId } = await setup();
        await join(owner, guest, tripId);

        assert.equal((await api().delete(`/trips/${tripId}/travelers/${guest.travelerId}`).set(signedIn(owner))).status, 204);
        assert.equal((await api().get(`/trips/${tripId}`).set(signedIn(guest))).status, 404);
        assert.equal((await api().delete(`/trips/${tripId}/travelers/${guest.travelerId}`).set(signedIn(owner))).status, 404);
        assert.equal((await invite(owner, tripId, guest.travelerId)).status, 201);
    });

    it('lets the owner cancel a pending invitation', async () => {
        const { owner, guest, tripId } = await setup();
        await invite(owner, tripId, guest.travelerId);

        assert.equal((await api().delete(`/trips/${tripId}/invitations/${guest.travelerId}`).set(signedIn(owner))).status, 204);
        assert.deepEqual((await api().get('/invitations').set(signedIn(guest))).body, []);
        assert.equal((await api().delete(`/trips/${tripId}/invitations/${guest.travelerId}`).set(signedIn(owner))).status, 404);
    });
});

describe('invitation errors', () => {
    it('rejects inviting yourself, a duplicate, a member, or an unknown traveler', async () => {
        const { owner, guest, tripId } = await setup();
        assert.equal((await invite(owner, tripId, owner.travelerId)).status, 400);
        assert.equal((await invite(owner, tripId, 'abc')).status, 400);
        assert.equal((await invite(owner, tripId, 999999)).status, 404);

        assert.equal((await invite(owner, tripId, guest.travelerId)).status, 201);
        const duplicate = await invite(owner, tripId, guest.travelerId);
        assert.equal(duplicate.status, 409);
        assert.match(duplicate.body.error, /already been invited/);

        const id = await invitationIdFor(guest, tripId);
        await api().post(`/invitations/${id}/accept`).set(signedIn(guest));
        const member = await invite(owner, tripId, guest.travelerId);
        assert.equal(member.status, 409);
        assert.match(member.body.error, /already on this trip/);
    });

    it("hides another account's trip from someone who isn't on it", async () => {
        const { tripId } = await setup();
        const stranger = await createAccount();
        const other = await createAccount();
        assert.equal((await invite(stranger, tripId, other.travelerId)).status, 404);
        assert.equal((await api().delete(`/trips/${tripId}/membership`).set(signedIn(stranger))).status, 404);
    });

    it("can't accept or decline someone else's invitation, or one already answered", async () => {
        const { owner, guest, tripId } = await setup();
        await invite(owner, tripId, guest.travelerId);
        const id = await invitationIdFor(guest, tripId);
        const stranger = await createAccount();

        assert.equal((await api().post(`/invitations/${id}/accept`).set(signedIn(stranger))).status, 404);
        assert.equal((await api().post(`/invitations/${id}/decline`).set(signedIn(owner))).status, 404);
        assert.equal((await api().post(`/invitations/${id}/accept`).set(signedIn(guest))).status, 200);
        assert.equal((await api().post(`/invitations/${id}/accept`).set(signedIn(guest))).status, 404);
        assert.equal((await api().post('/invitations/abc/accept').set(signedIn(guest))).status, 404);
    });

    it('requires a login', async () => {
        assert.equal((await api().get('/invitations')).status, 401);
        assert.equal((await api().post('/trips/1/invitations').send({ user_id: 2 })).status, 401);
    });
});

describe('daily invitation limit', () => {
    it('caps how many invitations one account sends in a day', async () => {
        const previous = process.env.INVITATIONS_PER_DAY;
        process.env.INVITATIONS_PER_DAY = '2';
        try {
            const { owner, tripId } = await setup();
            const guests = [await createAccount(), await createAccount(), await createAccount()];
            assert.equal((await invite(owner, tripId, guests[0].travelerId)).status, 201);
            assert.equal((await invite(owner, tripId, guests[1].travelerId)).status, 201);

            const blocked = await invite(owner, tripId, guests[2].travelerId);
            assert.equal(blocked.status, 429);
            assert.match(blocked.body.error, /up to 2 invitations a day/);

            // Another owner has their own allowance.
            const other = await setup();
            assert.equal((await invite(other.owner, other.tripId, guests[2].travelerId)).status, 201);

            // Invitations from more than a day ago no longer count.
            await knex('trip_invitations')
                .where({ trip_id: tripId })
                .update({ created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) });
            assert.equal((await invite(owner, tripId, guests[2].travelerId)).status, 201);
        } finally {
            if (previous === undefined) delete process.env.INVITATIONS_PER_DAY;
            else process.env.INVITATIONS_PER_DAY = previous;
        }
    });
});

describe('deleting a trip', () => {
    it('removes its invitations and memberships', async () => {
        const { owner, guest, tripId } = await setup();
        await join(owner, guest, tripId);
        const pendingGuest = await createAccount();
        await invite(owner, tripId, pendingGuest.travelerId);

        assert.equal((await api().delete(`/trips/${tripId}`).set(signedIn(owner))).status, 204);
        const counts = await Promise.all([
            knex('trip_invitations').where({ trip_id: tripId }).count({ n: '*' }).first(),
            knex('user_trips').where({ trip_id: tripId }).count({ n: '*' }).first(),
        ]);
        assert.deepEqual(counts.map((row) => Number(row.n)), [0, 0]);
        assert.deepEqual((await api().get('/invitations').set(signedIn(pendingGuest))).body, []);
    });
});
