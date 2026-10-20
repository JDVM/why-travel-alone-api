/**
 * Removes foreign-key rules that could silently delete user data:
 *
 * - trips.travelers -> user_trips.id ON DELETE CASCADE: a leftover from the
 *   original schema. Nothing reads or writes the column (it is always NULL;
 *   memberships live in user_trips), but if it were ever set, a member leaving
 *   would delete the whole trip. The column and its key are dropped.
 * - users.type_of_travel_id ON DELETE CASCADE: deleting a travel type would
 *   delete every traveler who picked it. Now SET NULL (the field is optional).
 * - trips.destination_id ON DELETE CASCADE: deleting a destination would
 *   delete every trip to it. Now RESTRICT, so it has to be dealt with first.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.alterTable('trips', (table) => {
        table.dropForeign('travelers');
        table.dropForeign('destination_id');
    });
    await knex.schema.alterTable('trips', (table) => {
        table.dropIndex('travelers', 'trips_travelers_foreign');
        table.dropColumn('travelers');
        table.foreign('destination_id').references('id').inTable('destinations').onUpdate('CASCADE').onDelete('RESTRICT');
    });

    await knex.schema.alterTable('users', (table) => {
        table.dropForeign('type_of_travel_id');
    });
    await knex.schema.alterTable('users', (table) => {
        table.foreign('type_of_travel_id').references('id').inTable('type_of_travel').onUpdate('CASCADE').onDelete('SET NULL');
    });
};

/**
 * Restores the original rules and the (empty) trips.travelers column.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.alterTable('users', (table) => {
        table.dropForeign('type_of_travel_id');
    });
    await knex.schema.alterTable('users', (table) => {
        table.foreign('type_of_travel_id').references('id').inTable('type_of_travel').onUpdate('CASCADE').onDelete('CASCADE');
    });

    await knex.schema.alterTable('trips', (table) => {
        table.dropForeign('destination_id');
    });
    await knex.schema.alterTable('trips', (table) => {
        table.integer('travelers').unsigned();
        table.foreign('travelers').references('id').inTable('user_trips').onUpdate('CASCADE').onDelete('CASCADE');
        table.foreign('destination_id').references('id').inTable('destinations').onUpdate('CASCADE').onDelete('CASCADE');
    });
};
