// Runs once before the test files: rebuilds the test database from scratch
// (rolling back every migration also exercises each down()), then seeds it.
require('./env');
const knex = require('../db');

async function prepare() {
    await knex.migrate.rollback(undefined, true);
    await knex.migrate.latest();
    await knex.seed.run();
}

prepare()
    .then(() => console.log(`Test database ${process.env.DB_LOCAL_DBNAME} migrated and seeded`))
    .catch((error) => {
        console.error('Preparing the test database failed', error);
        process.exitCode = 1;
    })
    .finally(() => knex.destroy());
