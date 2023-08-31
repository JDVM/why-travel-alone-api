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
      destination_id: 1,
      number_of_travelers: 3,
      notes: 'Exciting adventure awaits!'
    },
    {
      id: 2,
      trip_name: 'Culinary Exploration',
      destination_id: 2,
      number_of_travelers: 2,
      notes: 'Get ready for a gourmet journey!'
    },
    {
      id: 3,
      trip_name: 'Historical Journey',
      destination_id: 3, 
      number_of_travelers: 4,
      notes: 'Discover the past!'
    }
  ]);
};
