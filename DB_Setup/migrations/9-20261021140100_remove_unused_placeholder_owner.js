/**
 * Migration 9-20260703143000 creates a password-less placeholder account to
 * own trips that existed before accounts did. On a database that had no such
 * trips (every new database, production included) it owns nothing, so it is
 * removed. Databases where it does own trips keep it.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex('accounts')
        .where({ email: 'placeholder-owner@why-travel-alone.local' })
        .whereNull('password_hash')
        .whereNotExists(knex('trips').select(1).whereRaw('trips.owner_id = accounts.id'))
        .whereNotExists(knex('users').select(1).whereRaw('users.account_id = accounts.id'))
        .del();
};

/**
 * Nothing to restore: the account held no data.
 *
 * @returns { Promise<void> }
 */
exports.down = async function () {};
