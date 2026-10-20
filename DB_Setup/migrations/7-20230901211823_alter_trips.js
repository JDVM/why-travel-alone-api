/**
 * Intended to add the user_trips.trip_id -> trips.id foreign key, but up()
 * never returned the schema builder's promise, so knex never executed it, and
 * down() dropped the entire user_trips table instead of the constraint.
 *
 * Kept as an explicit no-op so existing knex_migrations records still match
 * the directory. The constraint is added by
 * 9-20261020170000_add_user_trips_trip_foreign_key.js.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function () {
    return Promise.resolve();
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function () {
    return Promise.resolve();
};
