const knex = require('../db');
const { verifyToken, passwordVersion } = require('../utils/auth');

// The single authentication boundary for the app.
//
// Everything behind this middleware reads req.account and never needs to know
// *how* the caller proved who they are. Swapping auth providers later (managed
// service, dedicated auth microservice, ...) means changing this one file to
// produce the same req.account shape — the route handlers stay untouched.
//
// A valid token is not enough on its own: the account must still exist, and
// the token must be newer than the last password change. So deleting an
// account or resetting its password signs out every session immediately
// instead of at token expiry.
async function authenticate(req, res, next) {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ error: 'Missing or malformed Authorization header' });
    }

    let payload;
    try {
        payload = verifyToken(token);
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    try {
        const account = await knex('accounts')
            .where({ id: payload.accountId })
            .first('id', 'email', 'email_verified_at', 'password_changed_at');
        // Issued under an earlier password (tokens from before this check have
        // no pwv, which counts as "never changed").
        const issuedBeforeChange = account && (payload.pwv || 0) !== passwordVersion(account);
        if (!account || issuedBeforeChange) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        req.account = {
            accountId: account.id,
            email: account.email,
            emailVerified: account.email_verified_at !== null,
        };
    } catch (error) {
        return next(error);
    }
    return next();
}

module.exports = authenticate;
