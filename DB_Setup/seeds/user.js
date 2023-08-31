/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('users').del()
  await knex('users').insert([
    {
      id: 1,
      first_name: 'Juan',
      last_name: 'Perez',
      has_kids: false,
      type_of_travel_id: 1,
      special_considerations: 'Blind'
    },
    {
      id: 2,
      first_name: 'Nichol',
      last_name: 'Smith',
      has_kids: false,
      type_of_travel_id: 4,
      special_considerations: 'Kosher Meals'
    },
    {
      id: 3,
      first_name: 'Jeremy',
      last_name: 'Brown',
      has_kids: false,
      type_of_travel_id: 7,
      special_considerations: 'Scared of Spider'
    },
    {
      id: 4,
      first_name: 'Emily',
      last_name: 'Johnson',
      has_kids: true,
      type_of_travel_id: 3,
      special_considerations: 'Gluten-free diet'
    },
    {
      id: 5,
      first_name: 'Alex',
      last_name: 'Anderson',
      has_kids: false,
      type_of_travel_id: 2,
      special_considerations: 'Vegan meals'
    },
    {
      id: 6,
      first_name: 'Lily',
      last_name: 'Martinez',
      has_kids: true,
      type_of_travel_id: 5,
      special_considerations: 'Hearing impairment'
    },
    {
      id: 7,
      first_name: 'Marco',
      last_name: 'Williams',
      has_kids: false,
      type_of_travel_id: 6,
      special_considerations: 'Claustrophobia'
    },
    {
      id: 8,
      first_name: 'Maya',
      last_name: 'Davis',
      has_kids: true,
      type_of_travel_id: 1,
      special_considerations: 'None'
    },
    {
      id: 9,
      first_name: 'Dylan',
      last_name: 'Rodriguez',
      has_kids: false,
      type_of_travel_id: 4,
      special_considerations: 'Vegetarian meals'
    },
    {
      id: 10,
      first_name: 'Sofia',
      last_name: 'Miller',
      has_kids: false,
      type_of_travel_id: 3,
      special_considerations: 'None'
    },
    {
      id: 11,
      first_name: 'Oliver',
      last_name: 'Taylor',
      has_kids: true,
      type_of_travel_id: 2,
      special_considerations: 'None'
    },
    {
      id: 12,
      first_name: 'Ava',
      last_name: 'Garcia',
      has_kids: false,
      type_of_travel_id: 7,
      special_considerations: 'Fear of heights'
    },
    {
      id: 13,
      first_name: 'Lucas',
      last_name: 'Brown',
      has_kids: false,
      type_of_travel_id: 1,
      special_considerations: 'None'
    },
    {
      id: 14,
      first_name: 'Mia',
      last_name: 'Wilson',
      has_kids: false,
      type_of_travel_id: 4,
      special_considerations: 'Halal meals'
    },
    {
      id: 15,
      first_name: 'Ethan',
      last_name: 'Anderson',
      has_kids: true,
      type_of_travel_id: 5,
      special_considerations: 'Mobility impairment'
    },
    {
      id: 16,
      first_name: 'Isabella',
      last_name: 'Martinez',
      has_kids: false,
      type_of_travel_id: 6,
      special_considerations: 'None'
    },
    {
      id: 17,
      first_name: 'Liam',
      last_name: 'Davis',
      has_kids: false,
      type_of_travel_id: 3,
      special_considerations: 'None'
    },
    {
      id: 18,
      first_name: 'Chloe',
      last_name: 'Smith',
      has_kids: true,
      type_of_travel_id: 2,
      special_considerations: 'Peanut allergy'
    },
    {
      id: 19,
      first_name: 'Noah',
      last_name: 'Johnson',
      has_kids: false,
      type_of_travel_id: 7,
      special_considerations: 'None'
    },
    {
      id: 20,
      first_name: 'Amelia',
      last_name: 'Garcia',
      has_kids: false,
      type_of_travel_id: 1,
      special_considerations: 'None'
    },
    {
      id: 21,
      first_name: 'Logan',
      last_name: 'Taylor',
      has_kids: true,
      type_of_travel_id: 4,
      special_considerations: 'None'
    },
    {
      id: 22,
      first_name: 'Harper',
      last_name: 'Brown',
      has_kids: false,
      type_of_travel_id: 5,
      special_considerations: 'None'
    },
    {
      id: 23,
      first_name: 'Jacob',
      last_name: 'Wilson',
      has_kids: false,
      type_of_travel_id: 6,
      special_considerations: 'None'
    },
    {
      id: 24,
      first_name: 'Olivia',
      last_name: 'Davis',
      has_kids: true,
      type_of_travel_id: 3,
      special_considerations: 'Autism'
    },
    {
      id: 25,
      first_name: 'Ava',
      last_name: 'Smith',
      has_kids: false,
      type_of_travel_id: 2,
      special_considerations: 'None'
    },
    {
      id: 26,
      first_name: 'William',
      last_name: 'Miller',
      has_kids: false,
      type_of_travel_id: 7,
      special_considerations: 'Motion sickness'
    },
    {
      id: 27,
      first_name: 'Emma',
      last_name: 'Johnson',
      has_kids: true,
      type_of_travel_id: 1,
      special_considerations: 'None'
    },
    {
      id: 28,
      first_name: 'Michael',
      last_name: 'Anderson',
      has_kids: false,
      type_of_travel_id: 4,
      special_considerations: 'None'
    },
    {
      id: 29,
      first_name: 'Sophia',
      last_name: 'Taylor',
      has_kids: false,
      type_of_travel_id: 5,
      special_considerations: 'None'
    },
    {
      id: 30,
      first_name: 'Benjamin',
      last_name: 'Martinez',
      has_kids: true,
      type_of_travel_id: 6,
      special_considerations: 'None'
    },
    {
      id: 31,
      first_name: 'Mia',
      last_name: 'Davis',
      has_kids: false,
      type_of_travel_id: 3,
      special_considerations: 'None'
    }
  ]);
};
