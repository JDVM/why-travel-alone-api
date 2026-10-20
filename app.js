const crypto = require('crypto');
const express = require('express');
const pinoHttp = require('pino-http');
const helmet = require('helmet');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');
const knex = require('./db');
const { corsOrigins, trustProxy } = require('./config');
const { logger: defaultLogger } = require('./logger');
const reportError = require('./utils/reportError');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth');
const travelerRoutes = require('./routes/travelers');
const tripsRoutes = require('./routes/trips');
const destinationRoutes = require('./routes/destinations');
const invitationRoutes = require('./routes/invitations');
const profileRoutes = require('./routes/profile');
const typesOfTravelRoutes = require('./routes/typesOfTravel');

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

// A request id from the proxy in front of the API, if it sends a sane one, so
// its logs and ours can be matched up; otherwise a new one.
const REQUEST_ID = /^[\w.:-]{1,128}$/;

function requestId(req, res) {
    const incoming = req.headers['x-request-id'];
    const id = typeof incoming === 'string' && REQUEST_ID.test(incoming) ? incoming : crypto.randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
}

function tooManyRequests(req, res) {
    req.log.warn({ event: 'auth.rate_limited', path: req.originalUrl.split('?')[0] }, 'Rate limit reached');
    res.status(429).json({ error: 'Too many attempts. Please wait a few minutes and try again.' });
}

// Builds the Express app without starting a server, so tests can create their
// own instance (optionally with their own logger). Rate-limit counters live in
// each instance's memory; running several server instances needs a shared
// store (e.g. Redis) instead.
function createApp(env = process.env, { logger = defaultLogger } = {}) {
    const app = express();

    const proxy = trustProxy(env);
    if (proxy !== undefined) {
        app.set('trust proxy', proxy);
    }

    // One access-log line per request (method, path, status, duration, account
    // id), with no headers or bodies. Handlers log through req.log.
    app.use(pinoHttp({
        logger,
        genReqId: requestId,
        quietReqLogger: true,
        autoLogging: { ignore: (req) => req.url === '/health' },
        customLogLevel: (req, res, err) => {
            if (err || res.statusCode >= 500) return 'error';
            if (res.statusCode >= 400) return 'warn';
            return 'info';
        },
        // On a 500 the handler has already logged the real error under the
        // same reqId; pino-http's own placeholder error would only add noise.
        customErrorMessage: () => 'request completed',
        customErrorObject: (req, res, err, { err: placeholder, ...line }) => line,
        customProps: (req) => (req.account ? { accountId: req.account.accountId } : {}),
        serializers: {
            req: (req) => ({ id: req.id, method: req.method, url: req.url.split('?')[0] }),
            res: (res) => ({ statusCode: res.statusCode }),
        },
    }));
    app.use(helmet());
    app.use(cors({ origin: corsOrigins(env) }));
    app.use(express.json({ limit: '10kb' }));

    // Password guessing: only failed attempts count, so normal use never hits it.
    app.use('/auth/login', rateLimit({
        windowMs: FIFTEEN_MINUTES,
        limit: 10,
        skipSuccessfulRequests: true,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        handler: tooManyRequests,
    }));
    // Mass account creation.
    app.use('/auth/register', rateLimit({
        windowMs: ONE_HOUR,
        limit: 10,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        handler: tooManyRequests,
    }));

    // For load balancers and uptime checks: is the API up and can it reach the database?
    app.get('/health', async (req, res) => {
        try {
            await knex.raw('select 1');
            res.status(200).json({ status: 'ok' });
        } catch (error) {
            reportError(req, error, 'Health check failed');
            res.status(503).json({ status: 'unavailable' });
        }
    });

    app.use('/auth', authRoutes);
    app.use('/travelers', travelerRoutes);
    app.use('/trips', tripsRoutes);
    app.use('/destinations', destinationRoutes);
    app.use('/invitations', invitationRoutes);
    app.use('/profile', profileRoutes);
    app.use('/types-of-travel', typesOfTravelRoutes);

    app.use((req, res) => {
        res.status(404).json({ error: 'Not found' });
    });
    app.use(errorHandler);

    return app;
}

module.exports = createApp;
