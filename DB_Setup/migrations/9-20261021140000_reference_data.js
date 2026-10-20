const { TYPES_OF_TRAVEL, DESTINATIONS } = require('../referenceData');

/**
 * Inserts the travel styles and destinations users choose from. They used to
 * come only from the development seeds, which a production database must not
 * run (they also create demo accounts), so a fresh production database had
 * empty pick lists.
 *
 * Rows that already exist (same id) are left as they are.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex('type_of_travel').insert(TYPES_OF_TRAVEL).onConflict('id').ignore();
    await knex('destinations').insert(DESTINATIONS).onConflict('id').ignore();
};

/**
 * Leaves the rows in place: profiles and trips may refer to them.
 *
 * @returns { Promise<void> }
 */
exports.down = async function () {};
