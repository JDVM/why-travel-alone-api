const { logger } = require('../logger');
const { captureException } = require('../monitoring');

// For catch blocks that answer with a 500: logs the error with the request's
// id and sends it to Sentry (when enabled), so failures that users only see as
// "Internal server error" still reach whoever runs the site.
function reportError(req, error, message) {
    const log = (req && req.log) || logger;
    log.error({ err: error }, message);
    captureException(error, {
        accountId: req && req.account ? req.account.accountId : undefined,
        requestId: req ? req.id : undefined,
        route: req ? `${req.method} ${req.baseUrl || ''}${req.route ? req.route.path : ''}` : undefined,
    });
}

module.exports = reportError;
