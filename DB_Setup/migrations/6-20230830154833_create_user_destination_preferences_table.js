/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.createSchema("user_destination_preferences",(table) => {
    table.increments('id').primary();
    table.integer("user").notNullable();
    table.integer("destination_id").notNullable();
    table.foreign('user_id').references("id").inTable("users").onUpdate("CASCADE").onDelete("CASCADE");
    table.foreign('destination_id').references("id").inTable("users").onUpdate("CASCADE").onDelete("CASCADE");
  })
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema.dropTable('user_destination_preferences')
};
