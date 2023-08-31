/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('user_trips').del()
  await knex('user_trips').insert([
    {
      id: 1,
      user_id: 1,
      trip_id: 1
  },
  {
      id: 2,
      user_id: 2,
      trip_id: 1
  },
  {
      id: 3,
      user_id: 3,
      trip_id: 1
  },
  {
      id: 4,
      user_id: 12,
      trip_id: 2
  },
  {
      id: 5,
      user_id: 19,
      trip_id: 2
  },
  {
      id: 6,
      user_id: 4,
      trip_id: 3
  },
  {
      id: 7,
      user_id: 20,
      trip_id: 3
  },
  {
      id: 8,
      user_id: 9,
      trip_id: 3
  },
  {
      id: 9,
      user_id: 6,
      trip_id: 3
  }
  ]);
};
