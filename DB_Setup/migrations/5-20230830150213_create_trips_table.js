/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.createTable("trips", (table) => {
        table.increments("id").primary();
        table.string("trip_name").notNullable();
        table.integer("destination_id").unsigned().notNullable();
        table.foreign('destination_id').references("id").inTable("destinations").onUpdate("CASCADE").onDelete("CASCADE");
        table.integer("trip_length").unsigned().notNullable();
        table.string("notes");
        table.string("kid_friendly").notNullable().checkIn(["true", "false"]);
        table.integer("travelers").unsigned();
        table.foreign("travelers").references("id").inTable("user_trips").onUpdate("CASCADE").onDelete("CASCADE");
    })
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.dropTable('trips')
};
