/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable("user_destination_preferences",(table) => {
    table.increments('id').primary();
    table.integer("user_id").unsigned().notNullable();
    table.integer("destination_id").unsigned().notNullable();
    table.foreign('user_id').references("id").inTable("users").onUpdate("CASCADE").onDelete("CASCADE");
    table.foreign('destination_id').references("id").inTable("destinations").onUpdate("CASCADE").onDelete("CASCADE");
  })
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema.dropTable('user_destination_preferences')
};
