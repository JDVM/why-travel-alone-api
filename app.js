const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');
const knex = require('./db');
const { corsOrigins, trustProxy } = require('./config');
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

function tooManyRequests(req, res) {
    res.status(429).json({ error: 'Too many attempts. Please wait a few minutes and try again.' });
}

// Builds the Express app without starting a server, so tests can create their
// own instance. Rate-limit counters live in each instance's memory; running
// several server instances needs a shared store (e.g. Redis) instead.
function createApp(env = process.env) {
    const app = express();

    const proxy = trustProxy(env);
    if (proxy !== undefined) {
        app.set('trust proxy', proxy);
    }

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
            console.error('Health check failed', error);
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
