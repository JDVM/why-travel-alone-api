const knex = require('../db');
const { verifyToken } = require('../utils/auth');

// The single authentication boundary for the app.
//
// Everything behind this middleware reads req.account and never needs to know
// *how* the caller proved who they are. Swapping auth providers later (managed
// service, dedicated auth microservice, ...) means changing this one file to
// produce the same req.account shape — the route handlers stay untouched.
//
// A valid token is not enough on its own: the account must still exist, so a
// deleted account's tokens stop working immediately instead of at expiry.
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
        const account = await knex('accounts').where({ id: payload.accountId }).first('id', 'email');
        if (!account) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        req.account = { accountId: account.id, email: account.email };
    } catch (error) {
        return next(error);
    }
    return next();
}

module.exports = authenticate;
