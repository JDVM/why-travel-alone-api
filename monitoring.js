// Error reporting to Sentry. Off unless SENTRY_DSN is set, so development and
// tests never send anything. Errors are always logged as well; Sentry adds
// alerting, grouping and stack traces on top of the logs.
//
// Privacy: events carry no request bodies, headers, cookies, query strings or
// IP addresses, and the only user detail is the numeric account id.

let Sentry = null;

const SENSITIVE_HEADERS = new Set(['authorization', 'cookie', 'x-forwarded-for', 'x-real-ip']);

// Strips anything personal Sentry might attach to an event.
function scrubEvent(event) {
    if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        delete event.request.query_string;
        if (event.request.url) {
            event.request.url = event.request.url.split('?')[0];
        }
        if (event.request.headers) {
            for (const name of Object.keys(event.request.headers)) {
                if (SENSITIVE_HEADERS.has(name.toLowerCase())) {
                    delete event.request.headers[name];
                }
            }
        }
    }
    if (event.user) {
        event.user = event.user.id === undefined ? undefined : { id: event.user.id };
    }
    return event;
}

// Call once at startup, before the app is loaded. Returns whether reporting is on.
function initMonitoring(env = process.env) {
    if (!env.SENTRY_DSN) {
        return false;
    }
    Sentry = require('@sentry/node');
    Sentry.init({
        dsn: env.SENTRY_DSN,
        environment: env.SENTRY_ENVIRONMENT || env.NODE_ENV || 'development',
        release: env.SENTRY_RELEASE || undefined,
        // Collect nothing personal; scrubEvent below is a second line of defense.
        dataCollection: {
            userInfo: false,
            cookies: false,
            httpHeaders: false,
            httpBodies: [],
            urlQueryParams: false,
            databaseQueryData: false,
            stackFrameVariables: false,
        },
        // Errors only; no performance tracing.
        tracesSampleRate: 0,
        // server.js handles crashes itself so they are logged before exiting.
        integrations: (defaults) =>
            defaults.filter((integration) => !['OnUncaughtException', 'OnUnhandledRejection'].includes(integration.name)),
        beforeSend: scrubEvent,
    });
    return true;
}

function captureException(error, { accountId, requestId, route } = {}) {
    if (!Sentry) return;
    Sentry.withScope((scope) => {
        if (accountId !== undefined) scope.setUser({ id: String(accountId) });
        if (requestId) scope.setTag('request_id', requestId);
        if (route) scope.setTag('route', route);
        Sentry.captureException(error);
    });
}

// Waits for queued events to be sent, e.g. before the process exits.
function flush(timeoutMs = 2000) {
    return Sentry ? Sentry.flush(timeoutMs) : Promise.resolve(true);
}

module.exports = { initMonitoring, captureException, flush, scrubEvent };
