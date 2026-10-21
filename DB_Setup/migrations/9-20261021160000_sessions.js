/**
 * Server-side login sessions, replacing signed tokens (JWTs).
 *
 * The browser holds a random session id in an httpOnly cookie; only its
 * SHA-256 hash is stored here, so a database leak doesn't reveal usable
 * sessions. A session can be ended at once by deleting its row: logging out,
 * "sign out other devices", a password reset and account deletion all do.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.createTable('sessions', (table) => {
        table.specificType('id', 'char(64)').primary();
        table.integer('account_id').unsigned().notNullable();
        // Shown in the list of signed-in devices, so people can recognise them.
        table.string('user_agent', 200).nullable();
        table.datetime('created_at').notNullable();
        table.datetime('last_seen_at').notNullable();
        table.datetime('expires_at').notNullable();
        table.foreign('account_id').references('id').inTable('accounts').onUpdate('CASCADE').onDelete('CASCADE');
        table.index('account_id');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.dropTable('sessions');
};
