/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('user_destination_preferences').del()
  await knex('user_destination_preferences').insert([
    {
      id: 1,
      user_id: 1,
      destination_id: 1
  },
  {
      id: 2,
      user_id: 2,
      destination_id: 2
  },
  {
      id: 3,
      user_id: 1,
      destination_id: 4
  },
  {
      id: 4,
      user_id: 5,
      destination_id: 2
  },
  {
      id: 5,
      user_id: 19,
      destination_id: 5
  },
  {
      id: 6,
      user_id: 6,
      destination_id: 94
  },
  {
      id: 7,
      user_id: 30,
      destination_id: 103
  },
  {
      id: 8,
      user_id: 2,
      destination_id: 195
  },
  {
      id: 9,
      user_id: 4,
      destination_id: 57
  },
  {
      id: 10,
      user_id: 5,
      destination_id: 36
  },
  {
      id: 11,
      user_id: 5,
      destination_id: 90
  },
  {
      id: 12,
      user_id: 27,
      destination_id: 88
  }
  ]);
};
