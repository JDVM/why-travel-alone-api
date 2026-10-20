require('dotenv').config();
const { configErrors } = require('./config');
const { logger } = require('./logger');
const monitoring = require('./monitoring');

const errors = configErrors();
if (errors.length > 0) {
    logger.fatal({ errors }, `Configuration error:\n${errors.map((error) => `  - ${error}`).join('\n')}`);
    process.exit(1);
}

// Before the app is loaded, so Sentry can hook into the libraries it uses.
const monitoringEnabled = monitoring.initMonitoring();

const createApp = require('./app');
const knex = require('./db');

const PORT = process.env.PORT || 5050;
const server = createApp().listen(PORT, () => {
    logger.info({ port: Number(PORT), errorReporting: monitoringEnabled }, `Server is running on port ${PORT}`);
});

// Hosting platforms send SIGTERM before stopping the process. Stop accepting
// connections, let in-flight requests finish, then close the database pool.
function shutdown(signal) {
    logger.info({ signal }, `${signal} received, shutting down`);
    server.close(() => {
        Promise.allSettled([knex.destroy(), monitoring.flush()]).finally(() => process.exit(0));
    });
    // Don't wait forever on idle keep-alive connections.
    setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// A promise rejected with nobody handling it is a bug, but the process is
// still in a known state: report it and keep serving.
process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'Unhandled promise rejection');
    monitoring.captureException(reason);
});

// After an uncaught exception the process state is unknown: report it, then
// exit and let the platform restart the server.
process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught exception');
    monitoring.captureException(error);
    monitoring.flush().finally(() => process.exit(1));
});
