// Points the app at the test database. Required first by every test file and
// by prepareDb.js, before anything loads db.js or knexfile.js.
//
// The tests wipe and re-seed the database they use, so they only ever run
// against DB_TEST_DBNAME, never the DB_LOCAL_DBNAME used for development.
require('dotenv').config();

const testDb = process.env.DB_TEST_DBNAME;
if (!testDb) {
    throw new Error(
        'Set DB_TEST_DBNAME to a separate, throwaway MySQL database. The tests wipe and re-seed it.'
    );
}
if (testDb === process.env.DB_LOCAL_DBNAME) {
    throw new Error('DB_TEST_DBNAME must name a different database from DB_LOCAL_DBNAME.');
}

process.env.DB_LOCAL_DBNAME = testDb;
process.env.NODE_ENV = 'test';
if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'test-only-secret-that-is-at-least-32-characters';
}
