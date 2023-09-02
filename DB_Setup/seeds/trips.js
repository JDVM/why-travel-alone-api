/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function (knex) {
  // Deletes ALL existing entries
  await knex('trips').del()
  await knex('trips').insert([
    {
      id: 1,
      trip_name: 'Trip to Adventureland',
      trip_length: 7,
      destination_id: 1,
      notes: 'Exciting adventure awaits!',
      kid_friendly:1
    },
    {
      id: 2,
      trip_name: 'Culinary Exploration',
      trip_length: 12,
      destination_id: 2,
      notes: 'Get ready for a gourmet journey!',
      kid_friendly:0
    },
    {
      id: 3,
      trip_name: 'Historical Journey',
      trip_length: 5,
      destination_id: 3, 
      notes: 'Discover the past!',
      kid_friendly:0
    }
  ]);
};
