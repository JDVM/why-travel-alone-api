/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.createTable('users', (table) => {
        table.increments('id').primary();
        table.string('first_name').notNullable();
        table.string('last_name').notNullable();
        table.boolean('has_kids').notNullable();
        table.integer('type_of_travel_id').unsigned().notNullable();
        table.string('special_considerations', 50);
        table.foreign('type_of_travel_id').references("id").inTable("type_of_travel").onUpdate("CASCADE").onDelete("CASCADE");
        table.integer('preferred_destination_id').unsigned();
        table.foreign('preferred_destination_id').references("id").inTable("destinations").onUpdate("CASCADE").onDelete("SET NULL");
    })
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.dropTable('users');
};
