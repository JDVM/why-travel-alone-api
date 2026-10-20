// The last middleware in the chain. Turns errors into JSON without leaking
// internals; Express's default handler sends an HTML page with the stack trace
// and server file paths.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Request body is not valid JSON' });
    }
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ error: 'Request body is too large' });
    }

    console.error('Unhandled error', err);
    return res.status(500).json({ error: 'Internal server error' });
}

module.exports = errorHandler;
