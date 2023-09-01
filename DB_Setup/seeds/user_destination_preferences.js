/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function (knex) {
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
        },
        {
            id: 13,
            user_id: 7,
            destination_id: 198
        },
        {
            id: 14,
            user_id: 3,
            destination_id: 198
        },
        {
            id: 15,
            user_id: 18,
            destination_id: 198
        },
        {
            id: 16,
            user_id: 8,
            destination_id: 198
        },
        {
            id: 17,
            user_id: 9,
            destination_id: 198
        },
        {
            id: 18,
            user_id: 10,
            destination_id: 198
        },
        {
            id: 19,
            user_id: 11,
            destination_id: 198
        },
        {
            id: 20,
            user_id: 12,
            destination_id: 198
        },
        {
            id: 21,
            user_id: 13,
            destination_id: 198
        },
        {
            id: 22,
            user_id: 14,
            destination_id: 198
        },
        {
            id: 23,
            user_id: 15,
            destination_id: 198
        },
        {
            id: 24,
            user_id: 16,
            destination_id: 198
        },
        {
            id: 25,
            user_id: 17,
            destination_id: 198
        },
        {
            id: 26,
            user_id: 20,
            destination_id: 198
        },
        {
            id: 27,
            user_id: 21,
            destination_id: 198
        },
        {
            id: 28,
            user_id: 22,
            destination_id: 198
        },
        {
            id: 29,
            user_id: 23,
            destination_id: 198
        },
        {
            id: 30,
            user_id: 24,
            destination_id: 198
        },
        {
            id: 31,
            user_id: 25,
            destination_id: 198
        },
        {
            id: 32,
            user_id: 26,
            destination_id: 198
        },
        {
            id: 33,
            user_id: 27,
            destination_id: 198
        },
        {
            id: 34,
            user_id: 28,
            destination_id: 198
        },
        {
            id: 35,
            user_id: 29,
            destination_id: 198
        },{
            id: 36,
            user_id: 31,
            destination_id: 198
        },

    ]);
};
