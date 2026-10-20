// Environment settings and the checks run once at startup, so a misconfigured
// deployment fails immediately with a clear message instead of on the first
// request that needs the missing value.

const MIN_JWT_SECRET_LENGTH = 32;
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

module.exports = { configErrors, corsOrigins, trustProxy, MIN_JWT_SECRET_LENGTH };
