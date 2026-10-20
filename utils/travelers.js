const knex = require('../db');

// Fields of a traveler profile that only some viewers may see.
const PRIVATE_FIELDS = ['has_kids', 'special_considerations'];

// The caller's traveler profile id, or undefined for an account without one.
async function travelerIdFor(accountId) {
    const row = await knex('users').where('account_id', accountId).first('id');
    return row ? row.id : undefined;
}

// Ids of the travelers whose private fields the caller may see: their own
// profile, and travelers on trips the caller owns (people only join a trip by
// accepting the owner's invitation).
async function privateViewIds(accountId) {
    const rows = await knex('users')
        .where('account_id', accountId)
        .select('id')
        .union(function () {
            this.select('user_trips.user_id as id')
                .from('user_trips')
                .join('trips', 'trips.id', 'user_trips.trip_id')
                .where('trips.owner_id', accountId);
        });
    return new Set(rows.map((row) => row.id));
}

// The traveler as the caller may see it: private fields removed unless the
// traveler is in visibleIds (from privateViewIds).
function forViewer(traveler, visibleIds) {
    if (visibleIds.has(traveler.user_id)) {
        return traveler;
    }
    const visible = { ...traveler };
    for (const field of PRIVATE_FIELDS) {
        delete visible[field];
    }
    return visible;
}

// { user_id, first_name, last_name } for the account's traveler, or null.
async function travelerSummary(accountId) {
    const traveler = await knex('users')
        .where('account_id', accountId)
        .first('id as user_id', 'first_name', 'last_name');
    return traveler || null;
}

module.exports = { travelerIdFor, privateViewIds, forViewer, travelerSummary };
