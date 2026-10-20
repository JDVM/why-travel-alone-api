/**
 * Travelers are the site's users: every traveler profile (users row) belongs
 * to exactly one account, and people join trips by accepting an invitation.
 *
 * 1. users.type_of_travel_id becomes nullable and has_kids defaults to false,
 *    because signup now asks only for a name; the rest is filled in later.
 * 2. users.account_id links each traveler to one account (unique, NOT NULL,
 *    ON DELETE CASCADE). It replaces the optional accounts.user_id link, which
 *    nothing used. Travelers that have no account yet get a placeholder
 *    account that can't log in (no password, an @placeholder.invalid email).
 * 3. trip_invitations: an owner invites a traveler; the invitation is pending
 *    until accepted (the traveler joins user_trips) or declined.
 * 4. Owners are travelers on their own trips: owner memberships are added to
 *    user_trips for existing trips.
 *
 * Naming: "9-" plus a later timestamp so it sorts after the other migrations
 * (knex orders files as strings, and "10-" would sort before "2-").
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.alterTable('users', (table) => {
        table.integer('type_of_travel_id').unsigned().nullable().alter();
        table.boolean('has_kids').notNullable().defaultTo(false).alter();
    });

    await knex.schema.alterTable('users', (table) => {
        table.integer('account_id').unsigned().nullable();
    });
    await knex.raw('UPDATE users u JOIN accounts a ON a.user_id = u.id SET u.account_id = a.id');
    const orphans = await knex('users').whereNull('account_id').select('id');
    for (const { id } of orphans) {
        const [accountId] = await knex('accounts').insert({
            email: `traveler-${id}@placeholder.invalid`,
            auth_provider: 'local',
        });
        await knex('users').where({ id }).update({ account_id: accountId });
    }
    await knex.schema.alterTable('users', (table) => {
        table.integer('account_id').unsigned().notNullable().alter();
    });
    await knex.schema.alterTable('users', (table) => {
        table.unique(['account_id']);
        table.foreign('account_id').references('id').inTable('accounts').onUpdate('CASCADE').onDelete('CASCADE');
    });

    await knex.schema.alterTable('accounts', (table) => {
        table.dropForeign('user_id');
    });
    await knex.schema.alterTable('accounts', (table) => {
        table.dropColumn('user_id');
    });

    await knex.schema.createTable('trip_invitations', (table) => {
        table.increments('id').primary();
        table.integer('trip_id').unsigned().notNullable();
        table.integer('user_id').unsigned().notNullable();
        table.enu('status', ['pending', 'accepted', 'declined']).notNullable().defaultTo('pending');
        table.timestamps(true, true);
        table.foreign('trip_id').references('id').inTable('trips').onUpdate('CASCADE').onDelete('CASCADE');
        table.foreign('user_id').references('id').inTable('users').onUpdate('CASCADE').onDelete('CASCADE');
        table.unique(['trip_id', 'user_id']);
    });

    await knex.raw(
        'INSERT IGNORE INTO user_trips (user_id, trip_id) ' +
        'SELECT u.id, t.id FROM trips t JOIN users u ON u.account_id = t.owner_id'
    );
};

/**
 * Restores the accounts.user_id link and removes users.account_id,
 * trip_invitations and the placeholder accounts.
 *
 * Not restored exactly:
 * - users.type_of_travel_id stays nullable, because travelers created after
 *   this migration may have no travel type, and inventing one would be wrong.
 * - Invitations are deleted, and owner memberships added to user_trips are
 *   kept (they're valid rows in the old schema).
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.dropTable('trip_invitations');

    await knex.schema.alterTable('accounts', (table) => {
        table.integer('user_id').unsigned();
        table.foreign('user_id').references('id').inTable('users').onUpdate('CASCADE').onDelete('SET NULL');
    });
    await knex.raw(
        "UPDATE accounts a JOIN users u ON u.account_id = a.id SET a.user_id = u.id " +
        "WHERE a.email NOT LIKE '%@placeholder.invalid'"
    );

    await knex.schema.alterTable('users', (table) => {
        table.dropForeign('account_id');
    });
    await knex.schema.alterTable('users', (table) => {
        table.dropUnique(['account_id']);
        table.dropColumn('account_id');
    });
    await knex('accounts').where('email', 'like', '%@placeholder.invalid').del();

    await knex.schema.alterTable('users', (table) => {
        table.boolean('has_kids').notNullable().alter();
    });
};
