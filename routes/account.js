const express = require("express");
const router = express.Router();
const knex = require("../db");
const reportError = require("../utils/reportError");
const authenticate = require("../middleware/authenticate");
const { verifyPassword } = require("../utils/auth");
const { isPasswordTooLong } = require("../utils/validate");
const { travelerIdFor } = require("../utils/travelers");

// The caller's rights over their own data: a copy of it (GDPR Art. 15 and 20)
// and erasure (Art. 17).
router.use(authenticate);

// Everything stored about the caller, as a JSON download. Other travelers
// appear only as the names the caller already sees in the app.
router.get("/export", async (req, res) => {
    try {
        const accountId = req.account.accountId;
        const account = await knex("accounts")
            .where("id", accountId)
            .first("id", "email", "auth_provider", "created_at", "terms_accepted_at", "terms_version");
        const travelerId = await travelerIdFor(accountId);

        let profile = null;
        let tripsJoined = [];
        let invitationsReceived = [];
        if (travelerId) {
            const traveler = await knex("users")
                .leftJoin("type_of_travel", "users.type_of_travel_id", "type_of_travel.id")
                .where("users.id", travelerId)
                .first(
                    "users.id as traveler_id",
                    "users.first_name",
                    "users.last_name",
                    "users.has_kids",
                    "users.special_considerations",
                    "users.sensitive_consent_at as special_considerations_consent_at",
                    "type_of_travel.type_of_travel"
                );
            const destinations = await knex("user_destination_preferences as preference")
                .join("destinations", "destinations.id", "preference.destination_id")
                .where("preference.user_id", travelerId)
                .orderBy("destinations.place")
                .pluck("destinations.place");
            profile = { ...traveler, has_kids: Boolean(traveler.has_kids), preferred_destinations: destinations };

            tripsJoined = await knex("user_trips")
                .join("trips", "trips.id", "user_trips.trip_id")
                .leftJoin("destinations", "destinations.id", "trips.destination_id")
                .leftJoin("users as owner", "owner.account_id", "trips.owner_id")
                .where("user_trips.user_id", travelerId)
                .whereNot("trips.owner_id", accountId)
                .select(
                    "trips.id as trip_id",
                    "trips.trip_name",
                    "destinations.place as destination",
                    "trips.trip_length",
                    "trips.kid_friendly",
                    "trips.notes",
                    knex.raw("CONCAT(owner.first_name, ' ', owner.last_name) as owner")
                )
                .orderBy("trips.id");

            invitationsReceived = await knex("trip_invitations as invitation")
                .join("trips", "trips.id", "invitation.trip_id")
                .where("invitation.user_id", travelerId)
                .select("trips.trip_name", "invitation.status", "invitation.created_at", "invitation.updated_at")
                .orderBy("invitation.created_at");
        }

        const tripsOwned = await knex("trips")
            .leftJoin("destinations", "destinations.id", "trips.destination_id")
            .where("trips.owner_id", accountId)
            .select(
                "trips.id as trip_id",
                "trips.trip_name",
                "destinations.place as destination",
                "trips.trip_length",
                "trips.kid_friendly",
                "trips.notes"
            )
            .orderBy("trips.id");

        const invitationsSent = await knex("trip_invitations as invitation")
            .join("trips", "trips.id", "invitation.trip_id")
            .join("users as invitee", "invitee.id", "invitation.user_id")
            .where("trips.owner_id", accountId)
            .select(
                "trips.trip_name",
                knex.raw("CONCAT(invitee.first_name, ' ', invitee.last_name) as invitee"),
                "invitation.status",
                "invitation.created_at",
                "invitation.updated_at"
            )
            .orderBy("invitation.created_at");

        const asBool = (trip) => ({ ...trip, kid_friendly: Boolean(trip.kid_friendly) });
        const exportedAt = new Date();
        res.set("Cache-Control", "no-store");
        res.attachment(`why-travel-alone-data-${exportedAt.toISOString().slice(0, 10)}.json`);
        res.status(200).json({
            exported_at: exportedAt.toISOString(),
            account,
            profile,
            trips_owned: tripsOwned.map(asBool),
            trips_joined: tripsJoined.map(asBool),
            invitations_received: invitationsReceived,
            invitations_sent: invitationsSent,
        });
    } catch (error) {
        reportError(req, error, "Error exporting account data");
        res.status(500).json({ error: "Internal server error" });
    }
});

// Deletes the account for good, with the password as confirmation. Trips the
// caller owns are deleted with it (their members lose access); the profile,
// memberships, invitations and preferences go through the database's cascades.
router.delete("/", async (req, res) => {
    const { password } = req.body || {};
    if (typeof password !== "string" || !password) {
        return res.status(400).json({ error: "Enter your password to delete your account" });
    }

    try {
        const accountId = req.account.accountId;
        const account = await knex("accounts").where("id", accountId).first("password_hash");
        const ok = !isPasswordTooLong(password) && (await verifyPassword(password, account.password_hash));
        if (!ok) {
            // 403, not 401: the caller is signed in, the confirmation is wrong.
            return res.status(403).json({ error: "Incorrect password" });
        }

        await knex.transaction(async (trx) => {
            await trx("trips").where("owner_id", accountId).del();
            await trx("accounts").where("id", accountId).del();
        });
        req.log.info({ event: "account.deleted", accountId }, "Account deleted");
        return res.status(204).end();
    } catch (error) {
        reportError(req, error, "Error deleting account");
        return res.status(500).json({ error: "Internal server error" });
    }
});

module.exports = router;
