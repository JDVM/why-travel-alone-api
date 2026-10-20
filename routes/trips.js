const express = require("express");
const router = express.Router();
const knex = require("../db");
const reportError = require("../utils/reportError");
const authenticate = require("../middleware/authenticate");
const { parseId, validateTripInput } = require("../utils/validate");
const { travelerIdFor, privateViewIds, forViewer } = require("../utils/travelers");

// Trips belong to their owner. Travelers join by accepting the owner's
// invitation; members can see the trip, only the owner can change it.
router.use(authenticate);

// Validates a create/update body, including that the destination exists (an
// unknown destination_id would otherwise fail the foreign key as a 500).
// Responds with 400 and returns undefined when the input is invalid.
async function readTripInput(req, res) {
    const { trip, error } = validateTripInput(req.body);
    if (error) {
        res.status(400).json({ error });
        return undefined;
    }
    const destination = await knex("destinations").where("id", trip.destination_id).first("id");
    if (!destination) {
        res.status(400).json({ error: "Unknown destination" });
        return undefined;
    }
    return trip;
}

// How the caller relates to a trip: { isOwner, travelerId } when they own it
// or are on it, otherwise undefined.
async function tripAccess(tripId, accountId) {
    const trip = await knex("trips").where("id", tripId).first("id", "owner_id");
    if (!trip) {
        return undefined;
    }
    const travelerId = await travelerIdFor(accountId);
    if (trip.owner_id === accountId) {
        return { isOwner: true, travelerId };
    }
    if (!travelerId) {
        return undefined;
    }
    const membership = await knex("user_trips").where({ trip_id: tripId, user_id: travelerId }).first("id");
    return membership ? { isOwner: false, travelerId } : undefined;
}

// Resolves :id and the caller's access. Answers 404 itself when the trip is
// missing or the caller has nothing to do with it (the same 404, so trips
// can't be probed), and 403 when ownerRequired and the caller is a member.
async function loadAccess(req, res, { ownerRequired = false } = {}) {
    const tripId = parseId(req.params.id);
    const access = tripId && (await tripAccess(tripId, req.account.accountId));
    if (!access) {
        res.status(404).json({ error: "Trip not found" });
        return undefined;
    }
    if (ownerRequired && !access.isOwner) {
        res.status(403).json({ error: "Only the trip's owner can do that" });
        return undefined;
    }
    return { tripId, ...access };
}

// Trips the caller owns or is on.
router.get("/", async (req, res) => {
    try {
        const accountId = req.account.accountId;
        const travelerId = (await travelerIdFor(accountId)) || 0;
        const trips = await knex("trips")
            .leftJoin("destinations", "destinations.id", "=", "trips.destination_id")
            .leftJoin("user_trips", "user_trips.trip_id", "=", "trips.id")
            .where("trips.owner_id", accountId)
            .orWhereExists(function () {
                this.select(1)
                    .from("user_trips as mine")
                    .whereRaw("mine.trip_id = trips.id")
                    .where("mine.user_id", travelerId);
            })
            .select(
                "trips.id as trip_id",
                "trips.trip_name",
                "trips.kid_friendly",
                "trips.trip_length",
                "trips.notes",
                "trips.destination_id",
                "destinations.place as destination",
                knex.raw("trips.owner_id = ? as is_owner", [accountId]),
                knex.raw("COUNT(user_trips.user_id) as num_travelers")
            )
            .groupBy("trips.id", "trips.trip_name", "destinations.place");

        res.status(200).json(trips);
    } catch (error) {
        reportError(req, error, "Error retrieving trips");
        res.status(500).json({ error: "Internal server error" });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const access = await loadAccess(req, res);
        if (!access) {
            return;
        }
        const { tripId, isOwner } = access;

        const tripQuery = knex("trips")
            .leftJoin("destinations", "destinations.id", "=", "trips.destination_id")
            .select(
                "trips.id as trip_id",
                "trips.trip_name",
                "trips.kid_friendly",
                "trips.trip_length",
                "trips.notes",
                "trips.destination_id",
                "destinations.place as destination"
            )
            .where("trips.id", tripId)
            .first();

        const usersQuery = knex("users")
            .select(
                "users.id as user_id",
                "users.first_name",
                "users.last_name",
                "users.has_kids",
                "users.special_considerations",
                "type_of_travel.type_of_travel as type_of_travel"
            )
            .leftJoin("type_of_travel", "users.type_of_travel_id", "=", "type_of_travel.id")
            .innerJoin("user_trips", "users.id", "=", "user_trips.user_id")
            .where("user_trips.trip_id", tripId);

        const [trip, users, visibleIds] = await Promise.all([
            tripQuery,
            usersQuery,
            privateViewIds(req.account.accountId),
        ]);

        const result = {
            ...trip,
            is_owner: isOwner,
            users: users.map((user) => forViewer(user, visibleIds)),
        };
        // Only the owner sees who has been invited, and who declined.
        if (isOwner) {
            result.invitations = await knex("trip_invitations")
                .join("users", "users.id", "trip_invitations.user_id")
                .where("trip_invitations.trip_id", tripId)
                .whereIn("trip_invitations.status", ["pending", "declined"])
                .select("trip_invitations.user_id", "users.first_name", "users.last_name", "trip_invitations.status");
        }

        res.status(200).json(result);
    } catch (error) {
        reportError(req, error, "Error retrieving trip");
        res.status(500).json({ error: "Internal server error" });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const access = await loadAccess(req, res, { ownerRequired: true });
        if (!access) {
            return;
        }

        const trip = await readTripInput(req, res);
        if (!trip) {
            return;
        }

        await knex("trips").where("id", access.tripId).update(trip);
        res.status(200).json({ message: "Trip updated successfully" });
    } catch (error) {
        reportError(req, error, "Error updating trip");
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// The owner is a traveler on their own trip, so creating one needs a profile.
router.post("/new", async (req, res) => {
    try {
        const travelerId = await travelerIdFor(req.account.accountId);
        if (!travelerId) {
            return res.status(400).json({ error: "Create your traveler profile before planning a trip" });
        }

        const trip = await readTripInput(req, res);
        if (!trip) {
            return;
        }

        const tripId = await knex.transaction(async (trx) => {
            const [id] = await trx("trips").insert({ ...trip, owner_id: req.account.accountId });
            await trx("user_trips").insert({ user_id: travelerId, trip_id: id });
            return id;
        });

        res.status(201).json({ message: "Trip added successfully", trip: tripId });
    } catch (error) {
        reportError(req, error, "Error creating trip");
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Deleting a trip also removes its memberships and invitations (ON DELETE CASCADE).
router.delete("/:id", async (req, res) => {
    try {
        const access = await loadAccess(req, res, { ownerRequired: true });
        if (!access) {
            return;
        }

        await knex("trips").where("id", access.tripId).delete();
        res.sendStatus(204);
    } catch (error) {
        reportError(req, error, "Error deleting trip");
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// The owner invites a traveler. A traveler who declined, or left the trip,
// can't be invited to it again.
router.post("/:id/invitations", async (req, res) => {
    try {
        const access = await loadAccess(req, res, { ownerRequired: true });
        if (!access) {
            return;
        }
        const { tripId } = access;

        const userId = parseId(req.body.user_id);
        if (!userId) {
            return res.status(400).json({ error: "user_id must be a positive whole number" });
        }
        if (userId === access.travelerId) {
            return res.status(400).json({ error: "You're already on this trip" });
        }
        if (!(await knex("users").where("id", userId).first("id"))) {
            return res.status(404).json({ error: "Traveler not found" });
        }
        if (await knex("user_trips").where({ trip_id: tripId, user_id: userId }).first("id")) {
            return res.status(409).json({ error: "Traveler is already on this trip" });
        }

        const existing = await knex("trip_invitations").where({ trip_id: tripId, user_id: userId }).first("status");
        if (existing && existing.status === "pending") {
            return res.status(409).json({ error: "Traveler has already been invited" });
        }
        if (existing && existing.status === "declined") {
            return res.status(409).json({ error: "Traveler declined an invitation to this trip" });
        }

        if (existing) {
            // Accepted earlier but no longer on the trip: invite again.
            await knex("trip_invitations")
                .where({ trip_id: tripId, user_id: userId })
                .update({ status: "pending", updated_at: knex.fn.now() });
        } else {
            await knex("trip_invitations").insert({ trip_id: tripId, user_id: userId });
        }
        res.status(201).json({ message: "Invitation sent" });
    } catch (error) {
        // A concurrent invite can still hit the (trip_id, user_id) unique index.
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ error: "Traveler has already been invited" });
        }
        reportError(req, error, "Error inviting traveler");
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// The owner withdraws a pending invitation.
router.delete("/:id/invitations/:userId", async (req, res) => {
    try {
        const access = await loadAccess(req, res, { ownerRequired: true });
        if (!access) {
            return;
        }
        const userId = parseId(req.params.userId);
        const deleted = userId
            ? await knex("trip_invitations").where({ trip_id: access.tripId, user_id: userId, status: "pending" }).delete()
            : 0;
        if (deleted === 0) {
            return res.status(404).json({ error: "Invitation not found" });
        }
        res.sendStatus(204);
    } catch (error) {
        reportError(req, error, "Error cancelling invitation");
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// The owner removes a traveler. Their invitation is cleared too, so the owner
// can invite them again later.
router.delete("/:id/travelers/:userId", async (req, res) => {
    try {
        const access = await loadAccess(req, res, { ownerRequired: true });
        if (!access) {
            return;
        }
        const userId = parseId(req.params.userId);
        if (userId && userId === access.travelerId) {
            return res.status(400).json({ error: "You can't remove yourself from your own trip; delete the trip instead" });
        }

        const removed = userId
            ? await knex.transaction(async (trx) => {
                const rows = await trx("user_trips").where({ trip_id: access.tripId, user_id: userId }).delete();
                await trx("trip_invitations").where({ trip_id: access.tripId, user_id: userId }).delete();
                return rows;
            })
            : 0;
        if (removed === 0) {
            return res.status(404).json({ error: "Traveler not found on trip" });
        }
        res.sendStatus(204);
    } catch (error) {
        reportError(req, error, "Error removing traveler");
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// A member leaves a trip. Recorded as a declined invitation, so the owner
// can't keep re-adding someone who left.
router.delete("/:id/membership", async (req, res) => {
    try {
        const access = await loadAccess(req, res);
        if (!access) {
            return;
        }
        if (access.isOwner) {
            return res.status(400).json({ error: "Owners can't leave their own trip; delete it instead" });
        }

        await knex.transaction(async (trx) => {
            await trx("user_trips").where({ trip_id: access.tripId, user_id: access.travelerId }).delete();
            await trx("trip_invitations")
                .insert({ trip_id: access.tripId, user_id: access.travelerId, status: "declined" })
                .onConflict(["trip_id", "user_id"])
                .merge({ status: "declined", updated_at: knex.fn.now() });
        });
        res.sendStatus(204);
    } catch (error) {
        reportError(req, error, "Error leaving trip");
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = router;
