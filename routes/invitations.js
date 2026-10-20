const express = require("express");
const router = express.Router();
const knex = require("../db");
const authenticate = require("../middleware/authenticate");
const { parseId } = require("../utils/validate");
const { travelerIdFor } = require("../utils/travelers");

// Invitations sent to the caller. Owners send them from routes/trips.js.
router.use(authenticate);

// The caller's pending invitation with this id, or undefined.
async function findPendingInvitation(req) {
    const id = parseId(req.params.id);
    const travelerId = await travelerIdFor(req.account.accountId);
    if (!id || !travelerId) {
        return undefined;
    }
    return knex("trip_invitations").where({ id, user_id: travelerId, status: "pending" }).first();
}

router.get("/", async (req, res) => {
    try {
        const travelerId = await travelerIdFor(req.account.accountId);
        if (!travelerId) {
            return res.status(200).json([]);
        }
        const invitations = await knex("trip_invitations as invitation")
            .join("trips", "trips.id", "invitation.trip_id")
            .leftJoin("destinations", "destinations.id", "trips.destination_id")
            .leftJoin("users as owner", "owner.account_id", "trips.owner_id")
            .where({ "invitation.user_id": travelerId, "invitation.status": "pending" })
            .select(
                "invitation.id as invitation_id",
                "trips.id as trip_id",
                "trips.trip_name",
                "trips.trip_length",
                "trips.kid_friendly",
                "destinations.place as destination",
                "owner.first_name as owner_first_name",
                "owner.last_name as owner_last_name",
                "invitation.created_at"
            )
            .orderBy("invitation.created_at", "desc");
        res.status(200).json(invitations);
    } catch (error) {
        console.error("Error retrieving invitations", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.post("/:id/accept", async (req, res) => {
    try {
        const invitation = await findPendingInvitation(req);
        if (!invitation) {
            return res.status(404).json({ error: "Invitation not found" });
        }
        await knex.transaction(async (trx) => {
            await trx("trip_invitations")
                .where({ id: invitation.id })
                .update({ status: "accepted", updated_at: knex.fn.now() });
            await trx("user_trips")
                .insert({ user_id: invitation.user_id, trip_id: invitation.trip_id })
                .onConflict(["user_id", "trip_id"])
                .ignore();
        });
        res.status(200).json({ trip_id: invitation.trip_id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.post("/:id/decline", async (req, res) => {
    try {
        const invitation = await findPendingInvitation(req);
        if (!invitation) {
            return res.status(404).json({ error: "Invitation not found" });
        }
        await knex("trip_invitations")
            .where({ id: invitation.id })
            .update({ status: "declined", updated_at: knex.fn.now() });
        res.sendStatus(204);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = router;
