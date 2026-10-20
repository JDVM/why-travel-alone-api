const express = require("express");
const router = express.Router();
const knex = require("../db");
const reportError = require("../utils/reportError");
const authenticate = require("../middleware/authenticate");
const { validateProfileInput } = require("../utils/validate");

// The caller's own traveler profile, including the private fields.
router.use(authenticate);

async function loadProfile(accountId) {
    const traveler = await knex("users")
        .leftJoin("type_of_travel", "users.type_of_travel_id", "type_of_travel.id")
        .where("users.account_id", accountId)
        .first(
            "users.id as user_id",
            "users.first_name",
            "users.last_name",
            "users.has_kids",
            "users.special_considerations",
            "users.sensitive_consent_at",
            "users.type_of_travel_id",
            "type_of_travel.type_of_travel"
        );
    if (!traveler) {
        return undefined;
    }
    const { sensitive_consent_at, ...profile } = traveler;
    const preferred_destinations = await knex("user_destination_preferences as preference")
        .join("destinations", "destinations.id", "preference.destination_id")
        .where("preference.user_id", profile.user_id)
        .select("destinations.id", "destinations.place")
        .orderBy("destinations.place");
    return { ...profile, special_considerations_consent: sensitive_consent_at !== null, preferred_destinations };
}

router.get("/", async (req, res) => {
    try {
        const profile = await loadProfile(req.account.accountId);
        if (!profile) {
            return res.status(404).json({ error: "No traveler profile yet" });
        }
        res.status(200).json(profile);
    } catch (error) {
        reportError(req, error, "Error retrieving profile");
        res.status(500).json({ error: "Internal server error" });
    }
});

// Replaces the whole profile (omitted optional fields are cleared), creating
// it for an older account that doesn't have one yet.
router.put("/", async (req, res) => {
    const { profile, destinationIds, error } = validateProfileInput(req.body);
    if (error) {
        return res.status(400).json({ error });
    }

    try {
        if (profile.type_of_travel_id !== null) {
            const type = await knex("type_of_travel").where("id", profile.type_of_travel_id).first("id");
            if (!type) {
                return res.status(400).json({ error: "Unknown travel type" });
            }
        }
        if (destinationIds.length > 0) {
            const found = await knex("destinations").whereIn("id", destinationIds).count({ n: "*" }).first();
            if (Number(found.n) !== destinationIds.length) {
                return res.status(400).json({ error: "Unknown destination" });
            }
        }

        const accountId = req.account.accountId;
        await knex.transaction(async (trx) => {
            const existing = await trx("users").where("account_id", accountId).first("id", "sensitive_consent_at");
            // Consent is recorded when first given and withdrawn by clearing
            // the field (validation guarantees consent when it has a value).
            const sensitive_consent_at = profile.special_considerations
                ? (existing && existing.sensitive_consent_at) || new Date()
                : null;
            let userId;
            if (existing) {
                userId = existing.id;
                await trx("users").where("id", userId).update({ ...profile, sensitive_consent_at });
            } else {
                [userId] = await trx("users").insert({ ...profile, sensitive_consent_at, account_id: accountId });
            }
            await trx("user_destination_preferences").where("user_id", userId).delete();
            if (destinationIds.length > 0) {
                await trx("user_destination_preferences").insert(
                    destinationIds.map((destination_id) => ({ user_id: userId, destination_id }))
                );
            }
        });

        res.status(200).json(await loadProfile(accountId));
    } catch (error) {
        reportError(req, error, "Error updating profile");
        res.status(500).json({ error: "Internal server error" });
    }
});

module.exports = router;
