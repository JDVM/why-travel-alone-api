require('dotenv').config()

// One configuration, read from the environment, for every NODE_ENV. db.js
// picks the config by NODE_ENV, and with only a "development" entry, setting
// NODE_ENV=production crashed the server at startup.
const config = {
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    database: process.env.DB_LOCAL_DBNAME,
    user: process.env.DB_LOCAL_USER,
    password: process.env.DB_LOCAL_PASSWORD
  },
  migrations: {
    tableName: 'knex_migrations',
    directory: './DB_Setup/migrations'
  },
  seeds: {
    directory: './DB_Setup/seeds'
  }
};

module.exports = {
  development: config,
  test: config,
  production: config,
};
