/**
 * Accounts are the identity source of truth for this application.
 *
 * We deliberately own identity locally even if a managed auth provider
 * (Auth0/Clerk/Supabase/...) is adopted later: every ownership foreign key in
 * the app points at accounts.id, so swapping the *credential* provider only
 * means repopulating auth_provider / auth_provider_id, never rewriting FKs.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.createTable('accounts', (table) => {
        table.increments('id').primary();
        table.string('email').notNullable().unique();

        // Nullable on purpose: provider-managed accounts may carry no local password.
        table.string('password_hash');

        // Seam for future provider migration. 'local' = credentials we manage.
        table.string('auth_provider').notNullable().defaultTo('local');
        table.string('auth_provider_id'); // external provider's user id, when applicable

        // Optional link to a traveler profile in the existing users table.
        table.integer('user_id').unsigned();
        table.foreign('user_id').references('id').inTable('users').onUpdate('CASCADE').onDelete('SET NULL');

        table.timestamps(true, true); // created_at, updated_at

        // A given external identity maps to at most one account.
        table.unique(['auth_provider', 'auth_provider_id']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.dropTable('accounts');
};
