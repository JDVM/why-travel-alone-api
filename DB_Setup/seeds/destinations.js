const { refuseInProduction } = require('../demoAccounts');
const { DESTINATIONS } = require('../referenceData');

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.seed = async function (knex) {
  refuseInProduction();
  // Deletes ALL existing entries. Trips reference destinations with ON DELETE
  // RESTRICT, so they go first (the trips seed, which runs next, recreates them).
  await knex('trips').del();
  await knex('destinations').del();
  await knex('destinations').insert(DESTINATIONS);
};
