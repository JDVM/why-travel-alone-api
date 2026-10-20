const { hashPassword } = require('../../utils/auth');
const { DEMO_PASSWORD, DEMO_TRAVELER_COUNT, travelerEmail, refuseInProduction } = require('../demoAccounts');
const { TERMS_VERSION } = require('../../config');

/**
 * One login per seeded traveler (see DB_Setup/demoAccounts.js). Account 1 is
 * demo@why-travel-alone.local, which owns the seeded trips 1-3.
 *
 * This seed upserts rather than deleting first: trips.owner_id references
 * accounts.id with onDelete RESTRICT, so wiping accounts while trips exist
 * would fail. Seeds run alphabetically, so this file (accounts) runs before
 * trips and users, and the accounts exist by the time those are inserted.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.seed = async function (knex) {
  refuseInProduction();
  const password_hash = await hashPassword(DEMO_PASSWORD);
  // Demo accounts have accepted the terms and confirmed their email.
  const terms = { terms_accepted_at: new Date(), terms_version: TERMS_VERSION, email_verified_at: new Date() };
  await knex('accounts')
    .insert({
      id: 1,
      email: travelerEmail(1),
      password_hash,
      auth_provider: 'local',
      ...terms,
    })
    .onConflict('id')
    .merge();

  const travelers = [];
  for (let id = 2; id <= DEMO_TRAVELER_COUNT; id++) {
    travelers.push({ email: travelerEmail(id), password_hash, auth_provider: 'local', ...terms });
  }
  await knex('accounts')
    .insert(travelers)
    .onConflict('email')
    .merge(['password_hash', 'terms_accepted_at', 'terms_version', 'email_verified_at']);
};
