/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.createTable("trips", (table) => {
        table.increments("id").primary();
        table.string("trip_name").notNullable();
        table.integer("destination_id").unsigned().notNullable();
        table.integer("number_oftravelers").unsigned().defaultTo(0);
        table.string("notes");
        table.foreign('destination_id').references("id").inTable("destinations").onUpdate("CASCADE").onDelete("CASCADE");
    })
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.dropTable('trips')
};
