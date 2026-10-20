const crypto = require('crypto');
const pino = require('pino');

// Structured JSON logs, one object per line, for the hosting platform's log
// collector. Request handlers log through req.log, which tags every line with
// the request id so one request's lines can be found together.

// Never written to logs, even if a future log call passes a whole request or
// body by mistake.
const REDACT_PATHS = [
    'req.headers.authorization',
    'req.headers.cookie',
    'res.headers["set-cookie"]',
    'password',
    'new_password',
    'token',
    '*.password',
    '*.new_password',
    '*.token',
    '*.password_hash',
];

function createLogger(env = process.env, destination) {
    const level = env.LOG_LEVEL || (env.NODE_ENV === 'test' ? 'silent' : 'info');
    return pino(
        {
            level,
            base: { service: 'why-travel-alone-api' },
            timestamp: pino.stdTimeFunctions.isoTime,
            redact: { paths: REDACT_PATHS, censor: '[redacted]' },
        },
        destination
    );
}

// A stable, non-reversible tag for an email address, so repeated failed logins
// for one address can be spotted without writing the address itself to the
// logs. Keyed with the server secret so it can't be reversed by hashing a list
// of known addresses.
function emailTag(email, env = process.env) {
    return crypto
        .createHmac('sha256', `log-email-tag:${env.JWT_SECRET || ''}`)
        .update(String(email).trim().toLowerCase())
        .digest('hex')
        .slice(0, 16);
}

const logger = createLogger();

module.exports = { logger, createLogger, emailTag };
