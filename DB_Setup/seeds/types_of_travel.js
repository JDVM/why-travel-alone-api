/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('type_of_travel').del()
  await knex('type_of_travel').insert([
    {
      id: 1,
      type_of_travel: 'Adventure'
  },
  {
      id: 2,
      type_of_travel: 'Gastro'
  },
  {
      id: 3,
      type_of_travel: 'Historical'
  },
  {
      id: 4,
      type_of_travel: 'Outdoor'
  },
  {
      id: 5,
      type_of_travel: 'Guided'
  },
  {
      id: 6,
      type_of_travel: 'Touristic'
  },
  {
      id: 7,
      type_of_travel: 'Urban'
  },
  {
      id: 8,
      type_of_travel: 'Child Friendly'
  },
  {
      id: 9,
      type_of_travel: 'Road Trip'
  },
  {
      id: 10,
      type_of_travel: 'Beach & Resort'
  },
  {
      id: 11,
      type_of_travel: 'Art and Culture'
  },
  {
      id: 12,
      type_of_travel: 'Music and Festivals'
  },
  {
      id: 13,
      type_of_travel: 'Luxury'
  },
  {
      id: 14,
      type_of_travel: 'Backpacking'
  }
  ]);
};
