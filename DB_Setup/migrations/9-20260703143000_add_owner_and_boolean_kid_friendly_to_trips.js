/**
 * The ownership increment.
 *
 * Two coupled changes to the trips table:
 *
 * 1. owner_id -> accounts.id. Trips predate the accounts table, so the existing
 *    seed rows have no owner. Rather than leave owner_id nullable (which would
 *    make "every trip has an owner" an invariant the code can't rely on), we
 *    create a single placeholder account and backfill the orphan rows to it,
 *    then enforce NOT NULL. New trips always set owner_id to the caller's
 *    account. Because owner_id is NOT NULL, onDelete is RESTRICT (not SET NULL):
 *    deleting an account that still owns trips must be handled explicitly rather
 *    than silently orphaning data.
 *
 * 2. kid_friendly string("true"/"false") -> real boolean. The string column was
 *    the root cause of a 1-vs-"true" mismatch with the frontend. We convert in
 *    place via a temp column so existing "true"/"false" values map to 1/0.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

const PLACEHOLDER_EMAIL = 'placeholder-owner@why-travel-alone.local';

exports.up = async function (knex) {
    // 1. Ensure a placeholder account exists to own pre-auth seed trips.
    let placeholder = await knex('accounts').where({ email: PLACEHOLDER_EMAIL }).first();
    if (!placeholder) {
        const inserted = await knex('accounts').insert({
            email: PLACEHOLDER_EMAIL,
            auth_provider: 'local',
        });
        placeholder = { id: inserted[0] };
    }

    // 2. Add owner_id nullable + FK, backfill orphans, then enforce NOT NULL.
    await knex.schema.alterTable('trips', (table) => {
        table.integer('owner_id').unsigned();
        table
            .foreign('owner_id')
            .references('id')
            .inTable('accounts')
            .onUpdate('CASCADE')
            .onDelete('RESTRICT');
    });

    await knex('trips').whereNull('owner_id').update({ owner_id: placeholder.id });

    await knex.schema.alterTable('trips', (table) => {
        table.integer('owner_id').unsigned().notNullable().alter();
    });

    // 3. Convert kid_friendly from string to boolean via a temp column so the
    //    existing "true"/"false" strings survive the type change.
    await knex.schema.alterTable('trips', (table) => {
        table.boolean('kid_friendly_bool').notNullable().defaultTo(false);
    });
    await knex('trips').update({ kid_friendly_bool: knex.raw("kid_friendly = 'true'") });
    await knex.schema.alterTable('trips', (table) => {
        table.dropColumn('kid_friendly'); // also drops the old checkIn(["true","false"]) constraint
    });
    await knex.schema.alterTable('trips', (table) => {
        table.renameColumn('kid_friendly_bool', 'kid_friendly');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    // Reverse the kid_friendly boolean -> string conversion.
    await knex.schema.alterTable('trips', (table) => {
        table.string('kid_friendly_str');
    });
    await knex('trips').update({
        kid_friendly_str: knex.raw("IF(kid_friendly, 'true', 'false')"),
    });
    await knex.schema.alterTable('trips', (table) => {
        table.dropColumn('kid_friendly');
    });
    await knex.schema.alterTable('trips', (table) => {
        table.renameColumn('kid_friendly_str', 'kid_friendly');
    });

    // Drop owner_id and its FK.
    await knex.schema.alterTable('trips', (table) => {
        table.dropForeign('owner_id');
        table.dropColumn('owner_id');
    });

    // Remove the placeholder account created in up().
    await knex('accounts').where({ email: PLACEHOLDER_EMAIL }).del();
};
