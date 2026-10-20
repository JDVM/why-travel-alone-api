// Input validation shared by the routes. Checking lengths and types here keeps
// bad input as a 400 instead of a database error surfacing as a 500.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_LENGTH = 254;
const PASSWORD_MIN_LENGTH = 8;
// bcrypt ignores everything after the first 72 bytes, so two longer passwords
// sharing those bytes would both match. Reject them instead.
const PASSWORD_MAX_BYTES = 72;
const TRIP_NAME_MAX_LENGTH = 255;
const NOTES_MAX_LENGTH = 255;
const TRIP_LENGTH_MAX_DAYS = 365;
const NAME_MAX_LENGTH = 255;
// users.special_considerations is a VARCHAR(50).
const SPECIAL_CONSIDERATIONS_MAX_LENGTH = 50;
const MAX_PREFERRED_DESTINATIONS = 20;

// A positive integer id from a route param or body field, or null.
function parseId(value) {
    if (typeof value === 'number') {
        return Number.isInteger(value) && value > 0 ? value : null;
    }
    if (typeof value === 'string' && /^[1-9]\d{0,9}$/.test(value)) {
        return Number(value);
    }
    return null;
}

// A non-negative integer from a number or a string of digits, or null.
function parseWholeNumber(value) {
    if (typeof value === 'number') {
        return Number.isInteger(value) && value >= 0 ? value : null;
    }
    if (typeof value === 'string' && /^\d{1,9}$/.test(value.trim())) {
        return Number(value.trim());
    }
    return null;
}

function normalizeEmail(email) {
    return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function isValidEmail(normalizedEmail) {
    return normalizedEmail.length <= EMAIL_MAX_LENGTH && EMAIL_REGEX.test(normalizedEmail);
}

function isPasswordTooLong(password) {
    return Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES;
}

// Error message for a password chosen at registration, or null if it's fine.
function newPasswordError(password) {
    if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
        return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
    }
    if (isPasswordTooLong(password)) {
        return `Password must be at most ${PASSWORD_MAX_BYTES} characters (fewer if it contains accented letters or emoji)`;
    }
    return null;
}

// kid_friendly is a boolean; "true"/"false" strings from older clients are
// still accepted. Returns undefined for anything else.
function normalizeKidFriendly(value) {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
}

// Validates a trip create/update body. Returns { trip } with normalized values,
// or { error } with a message for the client.
function validateTripInput(body) {
    const { trip_name, kid_friendly, trip_length, destination_id, notes } = body || {};

    if (typeof trip_name !== 'string' || trip_name.trim() === '') {
        return { error: 'Trip name is required' };
    }
    if (trip_name.trim().length > TRIP_NAME_MAX_LENGTH) {
        return { error: `Trip name must be at most ${TRIP_NAME_MAX_LENGTH} characters` };
    }

    const kidFriendly = normalizeKidFriendly(kid_friendly);
    if (kidFriendly === undefined) {
        return { error: 'Kid friendly must be true or false' };
    }

    // 0 is a valid length (a day trip), so check for null rather than falsiness.
    const tripLength = parseWholeNumber(trip_length);
    if (tripLength === null || tripLength > TRIP_LENGTH_MAX_DAYS) {
        return { error: `Trip length must be a whole number of days from 0 to ${TRIP_LENGTH_MAX_DAYS}` };
    }

    const destinationId = parseId(destination_id);
    if (destinationId === null) {
        return { error: 'A destination is required' };
    }

    if (notes !== undefined && notes !== null && typeof notes !== 'string') {
        return { error: 'Notes must be text' };
    }
    if (notes && notes.length > NOTES_MAX_LENGTH) {
        return { error: `Notes must be at most ${NOTES_MAX_LENGTH} characters` };
    }

    return {
        trip: {
            trip_name: trip_name.trim(),
            kid_friendly: kidFriendly,
            trip_length: tripLength,
            destination_id: destinationId,
            notes: notes || null,
        },
    };
}

// Error message for a required first or last name, or null.
function nameError(value, label) {
    if (typeof value !== 'string' || value.trim() === '') {
        return `${label} is required`;
    }
    if (value.trim().length > NAME_MAX_LENGTH) {
        return `${label} must be at most ${NAME_MAX_LENGTH} characters`;
    }
    return null;
}

// Validates a full profile (PUT /profile replaces the whole profile, so
// omitted optional fields are cleared). Returns { profile, destinationIds }
// or { error }. Whether the travel type and destinations exist is checked by
// the route.
//
// Special considerations can describe health conditions, so they are only
// accepted with explicit consent (special_considerations_consent: true).
function validateProfileInput(body) {
    const {
        first_name,
        last_name,
        has_kids,
        type_of_travel_id,
        special_considerations,
        special_considerations_consent,
        preferred_destination_ids,
    } = body || {};

    const error = nameError(first_name, 'First name') || nameError(last_name, 'Last name');
    if (error) {
        return { error };
    }

    if (has_kids !== undefined && typeof has_kids !== 'boolean') {
        return { error: 'Has kids must be true or false' };
    }

    let typeOfTravelId = null;
    if (type_of_travel_id !== undefined && type_of_travel_id !== null && type_of_travel_id !== '') {
        typeOfTravelId = parseId(type_of_travel_id);
        if (typeOfTravelId === null) {
            return { error: 'Unknown travel type' };
        }
    }

    if (special_considerations !== undefined && special_considerations !== null && typeof special_considerations !== 'string') {
        return { error: 'Special considerations must be text' };
    }
    const considerations = special_considerations ? special_considerations.trim() : '';
    if (considerations.length > SPECIAL_CONSIDERATIONS_MAX_LENGTH) {
        return { error: `Special considerations must be at most ${SPECIAL_CONSIDERATIONS_MAX_LENGTH} characters` };
    }
    if (considerations && special_considerations_consent !== true) {
        return {
            error: 'To save special considerations, agree to us storing them, or leave the field empty',
        };
    }

    let destinationIds = [];
    if (preferred_destination_ids !== undefined && preferred_destination_ids !== null) {
        if (!Array.isArray(preferred_destination_ids)) {
            return { error: 'Preferred destinations must be a list' };
        }
        const ids = preferred_destination_ids.map(parseId);
        if (ids.some((id) => id === null)) {
            return { error: 'Unknown destination' };
        }
        destinationIds = [...new Set(ids)];
        if (destinationIds.length > MAX_PREFERRED_DESTINATIONS) {
            return { error: `Choose at most ${MAX_PREFERRED_DESTINATIONS} preferred destinations` };
        }
    }

    return {
        profile: {
            first_name: first_name.trim(),
            last_name: last_name.trim(),
            has_kids: has_kids === true,
            type_of_travel_id: typeOfTravelId,
            special_considerations: considerations || null,
        },
        destinationIds,
    };
}

module.exports = {
    parseId,
    nameError,
    validateProfileInput,
    normalizeEmail,
    isValidEmail,
    isPasswordTooLong,
    newPasswordError,
    validateTripInput,
};
