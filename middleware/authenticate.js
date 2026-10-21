const { currentSession } = require('../utils/sessions');

// The single authentication boundary for the app.
//
// Everything behind this middleware reads req.account and never needs to know
// *how* the caller proved who they are. Swapping auth providers later (managed
// service, dedicated auth microservice, ...) means changing this one file to
// produce the same req.account shape — the route handlers stay untouched.
//
// The caller is identified by their session cookie, checked against the
// sessions table on every request, so ending a session (logout, password
// reset, account deletion) takes effect immediately.
async function authenticate(req, res, next) {
    let session;
    try {
        session = await currentSession(req);
    } catch (error) {
        return next(error);
    }
    if (!session) {
        return res.status(401).json({ error: 'Please log in' });
    }
    req.account = {
        accountId: session.account_id,
        email: session.email,
        emailVerified: session.email_verified_at !== null,
        sessionId: session.id,
    };
    return next();
}

module.exports = authenticate;
