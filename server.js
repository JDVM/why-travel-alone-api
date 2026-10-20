require('dotenv').config();
const { configErrors } = require('./config');

const errors = configErrors();
if (errors.length > 0) {
    console.error(`Configuration error:\n${errors.map((error) => `  - ${error}`).join('\n')}`);
    process.exit(1);
}

const createApp = require('./app');
const knex = require('./db');

const PORT = process.env.PORT || 5050;
const server = createApp().listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Hosting platforms send SIGTERM before stopping the process. Stop accepting
// connections, let in-flight requests finish, then close the database pool.
function shutdown(signal) {
    console.log(`${signal} received, shutting down`);
    server.close(() => {
        knex.destroy().finally(() => process.exit(0));
    });
    // Don't wait forever on idle keep-alive connections.
    setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
