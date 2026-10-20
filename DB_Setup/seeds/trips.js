const { accountIdsByTraveler } = require('../demoAccounts');

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function (knex) {
  // Deletes ALL existing entries
  await knex('trips').del()
  const accountIds = await accountIdsByTraveler(knex);
  await knex('trips').insert([
    {
      id: 1,
      trip_name: 'Trip to Adventureland',
      trip_length: 7,
      destination_id: 1,
      notes: 'Exciting adventure awaits!',
      kid_friendly: false,
      owner_id: 1
    },
    {
      id: 2,
      trip_name: 'Culinary Exploration',
      trip_length: 12,
      destination_id: 2,
      notes: 'Get ready for a gourmet journey!',
      kid_friendly: true,
      owner_id: 1
    },
    {
      id: 3,
      trip_name: 'Historical Journey',
      trip_length: 5,
      destination_id: 3,
      notes: 'Discover the past!',
      kid_friendly: false,
      owner_id: 1
    },
    {
      // Owned by traveler 2, with the demo account invited (see user_trips.js),
      // so the invitations page has something to show in development.
      id: 4,
      trip_name: 'Weekend in Lisbon',
      trip_length: 3,
      destination_id: 4,
      notes: 'Food, trams and viewpoints.',
      kid_friendly: true,
      owner_id: accountIds[2]
    }
  ]);
};
