require('dotenv').config()
const fs = require('fs');

// TLS to the database, for managed MySQL services that require or offer it.
// DB_SSL=true turns it on and verifies the server certificate, against
// DB_SSL_CA (a CA bundle file path, or the PEM text itself) when the provider
// uses its own certificate authority.
function ssl(env = process.env) {
  if (env.DB_SSL !== 'true') {
    return undefined;
  }
  const ca = env.DB_SSL_CA;
  return {
    rejectUnauthorized: true,
    ...(ca ? { ca: ca.includes('-----BEGIN') ? ca : fs.readFileSync(ca, 'utf8') } : {}),
  };
}

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
    password: process.env.DB_LOCAL_PASSWORD,
    ssl: ssl(),
  },
  // Connections open as needed, up to DB_POOL_MAX (default 10). Keep
  // DB_POOL_MAX times the number of API instances below the database's limit.
  pool: { min: 0, max: Number(process.env.DB_POOL_MAX) || 10 },
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

module.exports.ssl = ssl;
