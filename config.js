// Environment settings and the checks run once at startup, so a misconfigured
// deployment fails immediately with a clear message instead of on the first
// request that needs the missing value.

const MIN_JWT_SECRET_LENGTH = 32;

// The version of the terms and privacy policy new accounts accept, stored with
// each account. Change it whenever the published documents change.
const TERMS_VERSION = '2026-10-21';
const DEFAULT_CORS_ORIGIN = 'http://localhost:3000';

function configErrors(env = process.env) {
    const errors = [];

    if (!env.JWT_SECRET || env.JWT_SECRET.length < MIN_JWT_SECRET_LENGTH) {
        errors.push(
            `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters. Generate one with: openssl rand -hex 32`
        );
    }
    if (env.NODE_ENV === 'production' && !env.CORS_ORIGIN) {
        errors.push('CORS_ORIGIN must be set in production to the frontend URL, e.g. https://app.example.com');
    }
    if (env.NODE_ENV === 'production') {
        // Verification and password-reset emails need a mail server and the
        // frontend address their links point to.
        if (!env.SMTP_HOST) {
            errors.push('SMTP_HOST must be set in production (with SMTP_PORT, SMTP_USER and SMTP_PASS as needed)');
        }
        if (!env.MAIL_FROM) {
            errors.push('MAIL_FROM must be set in production, e.g. "Why Travel Alone <no-reply@example.com>"');
        }
        if (!/^https:\/\//.test(env.APP_URL || '')) {
            errors.push('APP_URL must be set in production to the https:// frontend URL used in email links');
        }
    }
    for (const name of ['DB_LOCAL_DBNAME', 'DB_LOCAL_USER']) {
        if (!env[name]) {
            errors.push(`${name} must be set`);
        }
    }

    return errors;
}

// Browser origins allowed to call the API: a comma-separated CORS_ORIGIN, or
// the local frontend during development.
function corsOrigins(env = process.env) {
    return (env.CORS_ORIGIN || DEFAULT_CORS_ORIGIN)
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
}

// Express "trust proxy" setting. Behind a load balancer or platform proxy it
// must be set (usually to the number of proxy hops, e.g. 1) so rate limiting
// sees each client's real IP instead of the proxy's. Unset means no proxy.
function trustProxy(env = process.env) {
    const value = env.TRUST_PROXY;
    if (value === undefined || value === '') return undefined;
    return /^\d+$/.test(value) ? Number(value) : value;
}

module.exports = { configErrors, corsOrigins, trustProxy, MIN_JWT_SECRET_LENGTH, TERMS_VERSION };
