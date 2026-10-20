const { refuseInProduction } = require('../demoAccounts');
const { TYPES_OF_TRAVEL } = require('../referenceData');

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.seed = async function (knex) {
  refuseInProduction();
  // Deletes ALL existing entries (travelers' travel style is set to NULL).
  await knex('type_of_travel').del();
  await knex('type_of_travel').insert(TYPES_OF_TRAVEL);
};
