const { readSessionId } = require('../utils/sessions');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Cross-site request forgery protection, on top of the SameSite cookie.
// Requests that change something must come from the web app: browsers send an
// Origin header with them, and it must be one of the allowed origins. A
// request carrying a session cookie but no Origin is refused too. Clients
// without a session (e.g. a health check) are unaffected.
function trustedOrigin(allowedOrigins) {
    return (req, res, next) => {
        if (SAFE_METHODS.has(req.method)) {
            return next();
        }
        const origin = req.get('origin');
        if (origin ? !allowedOrigins.includes(origin) : readSessionId(req)) {
            req.log.warn({ event: 'csrf.blocked', origin: origin || null }, 'Request from an untrusted origin');
            return res.status(403).json({ error: 'Request origin not allowed' });
        }
        return next();
    };
}

module.exports = trustedOrigin;
