const { hashPassword } = require('../../utils/auth');

/**
 * A single demo account that owns the seeded trips, so the seeded data is
 * reachable through the now owner-scoped trip endpoints. Log in with
 * demo@why-travel-alone.local / password123 in development.
 *
 * This seed upserts rather than deleting first: trips.owner_id references
 * accounts.id with onDelete RESTRICT, so wiping accounts while trips exist
 * would fail. Seeds run alphabetically, so this file (accounts) runs before
 * trips and the owner exists by the time trips are inserted.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.seed = async function (knex) {
  const password_hash = await hashPassword('password123');
  await knex('accounts')
    .insert({
      id: 1,
      email: 'demo@why-travel-alone.local',
      password_hash,
      auth_provider: 'local',
    })
    .onConflict('id')
    .merge();
};
