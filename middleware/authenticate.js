const { verifyToken } = require('../utils/auth');

// The single authentication boundary for the app.
//
// Everything behind this middleware reads req.account and never needs to know
// *how* the caller proved who they are. Swapping auth providers later (managed
// service, dedicated auth microservice, ...) means changing this one file to
// produce the same req.account shape — the route handlers stay untouched.
function authenticate(req, res, next) {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ error: 'Missing or malformed Authorization header' });
    }

    try {
        const payload = verifyToken(token);
        req.account = { accountId: payload.accountId, email: payload.email };
        return next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

module.exports = authenticate;
