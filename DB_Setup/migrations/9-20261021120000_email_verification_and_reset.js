/**
 * Email verification and password reset.
 *
 * - accounts.email_verified_at: when the account proved it controls its email
 *   address. Unverified accounts can use the app but can't send or accept
 *   invitations.
 * - accounts.password_changed_at: login tokens issued before this time are
 *   rejected, so resetting a password signs out every other session.
 *   Millisecond precision, so a login right after a reset isn't rounded into
 *   the past.
 * - account_tokens: one-time links sent by email. Only a SHA-256 hash of each
 *   token is stored, so a database leak doesn't reveal usable links.
 *
 * Existing accounts start unverified; the seeds verify the demo accounts.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.alterTable('accounts', (table) => {
        table.datetime('email_verified_at').nullable();
        table.datetime('password_changed_at', { precision: 3 }).nullable();
    });

    await knex.schema.createTable('account_tokens', (table) => {
        table.increments('id').primary();
        table.integer('account_id').unsigned().notNullable();
        table.enu('purpose', ['verify_email', 'reset_password']).notNullable();
        table.specificType('token_hash', 'char(64)').notNullable().unique();
        table.datetime('expires_at').notNullable();
        table.datetime('used_at').nullable();
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.foreign('account_id').references('id').inTable('accounts').onUpdate('CASCADE').onDelete('CASCADE');
        table.index(['account_id', 'purpose']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.dropTable('account_tokens');
    await knex.schema.alterTable('accounts', (table) => {
        table.dropColumn('email_verified_at');
        table.dropColumn('password_changed_at');
    });
};
