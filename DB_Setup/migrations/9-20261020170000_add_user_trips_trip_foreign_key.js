/**
 * Enforce user_trips.trip_id -> trips.id, and one row per (user, trip).
 *
 * Migration 7 was meant to add this foreign key but never returned its
 * promise, so knex never ran it: on every database built from these
 * migrations, user_trips.trip_id has had no constraint. Deleting a trip left
 * its traveler links orphaned, and links could point at trips that don't
 * exist. Adding the constraint here (instead of fixing migration 7, which
 * existing databases have already recorded as run) means fresh and existing
 * databases end up identical.
 *
 * Naming: knex orders migration files by plain string comparison, so a "10-"
 * prefix would sort between "1-" and "2-" and run before the trips table
 * exists. Keeping the "9-" prefix with a later timestamp sorts it last.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    // Remove rows the new constraints would reject: links to trips that no
    // longer exist, and duplicate (user_id, trip_id) pairs (keeping the oldest).
    await knex('user_trips').whereNotIn('trip_id', knex('trips').select('id')).del();
    await knex.raw(
        'DELETE ut FROM user_trips ut ' +
        'JOIN user_trips keep ON keep.user_id = ut.user_id AND keep.trip_id = ut.trip_id AND keep.id < ut.id'
    );

    await knex.schema.alterTable('user_trips', (table) => {
        table.foreign('trip_id').references('id').inTable('trips').onUpdate('CASCADE').onDelete('CASCADE');
        table.unique(['user_id', 'trip_id']);
    });
};

/**
 * Restores the table to its pre-up() shape. Rows removed by up() are not
 * restored.
 *
 * MySQL drops the implicit index behind the user_id foreign key once the
 * (user_id, trip_id) unique index can serve it, so a plain user_id index has
 * to be recreated before the unique index can be dropped.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.alterTable('user_trips', (table) => {
        table.dropForeign('trip_id');
    });
    await knex.schema.alterTable('user_trips', (table) => {
        table.dropIndex('trip_id', 'user_trips_trip_id_foreign');
        table.index('user_id', 'user_trips_user_id_foreign');
    });
    await knex.schema.alterTable('user_trips', (table) => {
        table.dropUnique(['user_id', 'trip_id']);
    });
};
