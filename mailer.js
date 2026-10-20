const nodemailer = require('nodemailer');
const { logger } = require('./logger');

// Sends the app's emails through any SMTP provider (SMTP_HOST etc.).
//
// Without SMTP_HOST (development only; production refuses to start without
// it) emails are written to the log instead, so links can be copied from
// the terminal. Under test they are kept in `outbox`.

const outbox = [];
let transport;

function createTransport(env = process.env) {
    if (env.SMTP_HOST) {
        return nodemailer.createTransport({
            host: env.SMTP_HOST,
            port: Number(env.SMTP_PORT || 587),
            // true for port 465 (TLS from the start); otherwise STARTTLS is
            // required, unless SMTP_REQUIRE_TLS=false (local mail catchers only).
            secure: env.SMTP_SECURE === 'true',
            requireTLS: env.SMTP_SECURE !== 'true' && env.SMTP_REQUIRE_TLS !== 'false',
            auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
        });
    }
    if (env.NODE_ENV === 'test') {
        return {
            sendMail: async (message) => {
                outbox.push(message);
                return { messageId: `test-${outbox.length}` };
            },
        };
    }
    return {
        sendMail: async (message) => {
            // No recipient address: logs never hold email addresses.
            logger.info({ mail: { subject: message.subject } }, `Email not sent (SMTP_HOST is not set):\n${message.text}`);
            return { messageId: 'logged' };
        },
    };
}

function appUrl(env = process.env) {
    return (env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

async function sendMail({ to, subject, text }) {
    transport = transport || createTransport();
    return transport.sendMail({
        from: process.env.MAIL_FROM || 'Why Travel Alone <no-reply@localhost>',
        to,
        subject,
        text,
    });
}

function verificationEmail(token) {
    const link = `${appUrl()}/verify-email?token=${encodeURIComponent(token)}`;
    return {
        subject: 'Confirm your email address',
        text: [
            'Welcome to Why Travel Alone!',
            '',
            'Confirm your email address by opening this link:',
            link,
            '',
            'The link works for 48 hours. If you didn’t create an account, you can ignore this email.',
        ].join('\n'),
    };
}

function passwordResetEmail(token) {
    const link = `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`;
    return {
        subject: 'Reset your password',
        text: [
            'Someone asked to reset the password for your Why Travel Alone account.',
            '',
            'Choose a new password here:',
            link,
            '',
            'The link works for 1 hour and only once. If you didn’t ask for this, ignore this email; your password stays the same.',
        ].join('\n'),
    };
}

function passwordChangedEmail() {
    return {
        subject: 'Your password was changed',
        text: [
            'The password for your Why Travel Alone account was just changed, and every device was signed out.',
            '',
            `If this wasn’t you, reset your password now at ${appUrl()}/forgot-password and contact us.`,
        ].join('\n'),
    };
}

module.exports = {
    sendMail,
    outbox,
    appUrl,
    verificationEmail,
    passwordResetEmail,
    passwordChangedEmail,
    // For tests that need a different transport.
    setTransport: (t) => {
        transport = t;
    },
};
