// Development logins for the seeded travelers. Traveler 1 is the demo
// account (demo@why-travel-alone.local); travelers 2-31 are
// traveler<N>@why-travel-alone.local. All use the password "password123".
//
// Lives outside DB_Setup/seeds/ because knex treats every file there as a seed.

const DEMO_PASSWORD = 'password123';
const DEMO_TRAVELER_COUNT = 31;

function travelerEmail(travelerId) {
    return travelerId === 1 ? 'demo@why-travel-alone.local' : `traveler${travelerId}@why-travel-alone.local`;
}

// { travelerId: accountId } for the seeded travelers.
async function accountIdsByTraveler(knex) {
    const travelerIds = Array.from({ length: DEMO_TRAVELER_COUNT }, (_, i) => i + 1);
    const rows = await knex('accounts').whereIn('email', travelerIds.map(travelerEmail)).select('id', 'email');
    const idByEmail = Object.fromEntries(rows.map((row) => [row.email, row.id]));
    return Object.fromEntries(travelerIds.map((id) => [id, idByEmail[travelerEmail(id)]]));
}

module.exports = { DEMO_PASSWORD, DEMO_TRAVELER_COUNT, travelerEmail, accountIdsByTraveler };
