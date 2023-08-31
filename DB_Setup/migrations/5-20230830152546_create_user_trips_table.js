/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('user_trips', (table) => {
    table.increments("id").primary();
    table.integer("user_id").unsigned().notNullable();
    table.integer("trip_id").unsigned().notNullable();
    table.foreign('user_id').references("id").inTable("users")//.onUpdate("CASCADE").onDelete("CASCADE");
    table.foreign('trip_id').references("id").inTable("trips")//.onUpdate("CASCADE").onDelete("CASCADE");
  })
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema.dropTable('user_trips')
};
