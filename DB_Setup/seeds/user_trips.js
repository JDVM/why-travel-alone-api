/**
 * Trip memberships and invitations. Owners are travelers on their own trips
 * (traveler 1 is the demo account, which owns trips 1-3; traveler 2 owns
 * trip 4). Two pending invitations show both sides of the invitation flow.
 *
 * Invitations are seeded here rather than in their own file because seeds run
 * alphabetically, and a "trip_invitations" seed would run before trips and
 * users exist.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('trip_invitations').del()
  await knex('user_trips').del()
  await knex('user_trips').insert([
    { id: 1, user_id: 1, trip_id: 1 },
    { id: 2, user_id: 2, trip_id: 1 },
    { id: 3, user_id: 3, trip_id: 1 },
    { id: 4, user_id: 12, trip_id: 2 },
    { id: 5, user_id: 19, trip_id: 2 },
    { id: 6, user_id: 4, trip_id: 3 },
    { id: 7, user_id: 20, trip_id: 3 },
    { id: 8, user_id: 9, trip_id: 3 },
    { id: 9, user_id: 6, trip_id: 3 },
    // Owners on their own trips.
    { id: 10, user_id: 1, trip_id: 2 },
    { id: 11, user_id: 1, trip_id: 3 },
    { id: 12, user_id: 2, trip_id: 4 },
  ]);
  await knex('trip_invitations').insert([
    // The demo account is invited to traveler 2's trip...
    { trip_id: 4, user_id: 1, status: 'pending' },
    // ...and has invited traveler 5 to one of its own.
    { trip_id: 1, user_id: 5, status: 'pending' },
  ]);
};
