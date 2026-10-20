/**
 * Records the consents the privacy rules depend on:
 *
 * - accounts.terms_accepted_at / terms_version: when an account accepted the
 *   terms and privacy policy at signup, and which version.
 * - users.sensitive_consent_at: when the traveler explicitly agreed to us
 *   storing their special considerations. That free-text field can hold health
 *   information (e.g. "Hearing impairment"), which GDPR Art. 9 only allows
 *   with explicit consent. The API refuses to store it without consent and
 *   clears this column when the field is cleared.
 *
 * Existing rows get NULL: a consent nobody gave can't be backfilled. Before
 * launch there is no real user data; the seeds set both for demo travelers.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.alterTable('accounts', (table) => {
        table.datetime('terms_accepted_at').nullable();
        table.string('terms_version', 20).nullable();
    });
    await knex.schema.alterTable('users', (table) => {
        table.datetime('sensitive_consent_at').nullable();
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.alterTable('users', (table) => {
        table.dropColumn('sensitive_consent_at');
    });
    await knex.schema.alterTable('accounts', (table) => {
        table.dropColumn('terms_accepted_at');
        table.dropColumn('terms_version');
    });
};
