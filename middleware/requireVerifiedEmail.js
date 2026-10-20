// For actions that reach other people (sending and accepting invitations):
// the account must have confirmed its email address first. Goes after
// authenticate.
function requireVerifiedEmail(req, res, next) {
    if (!req.account.emailVerified) {
        return res.status(403).json({ error: 'Confirm your email address first. Check your inbox for the link.' });
    }
    return next();
}

module.exports = requireVerifiedEmail;
