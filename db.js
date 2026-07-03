// Single shared Knex instance (one connection pool for the whole app).
// New code should require this rather than constructing its own knex(),
// which the per-route files currently do and should be migrated to use.
const knexConfig = require('./knexfile');

const environment = process.env.NODE_ENV || 'development';
const knex = require('knex')(knexConfig[environment]);

module.exports = knex;
