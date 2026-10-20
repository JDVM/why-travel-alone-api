const express = require("express");
const router = express.Router();
const knex = require("../db");
const authenticate = require("../middleware/authenticate");

// kid_friendly is a real boolean in the schema now. Accept a boolean, or the
// "true"/"false" strings a not-yet-updated client might still send, and reject
// anything else. Returns undefined when the value is missing/invalid so callers
// can treat "not provided" and "false" differently.
function normalizeKidFriendly(value) {
    if (typeof value === "boolean") return value;
    if (value === "true") return true;
    if (value === "false") return false;
    return undefined;
}

// Empty means missing. Note: 0 and false are intentionally NOT empty — a
// trip_length of 0 and kid_friendly of false are both legitimate values.
const isEmpty = (value) => value === undefined || value === null || value === "";

// List only the caller's own trips.
router.get("/", authenticate, async (req, res) => {
    try {
        const trips = await knex("trips")
            .leftJoin("destinations", "destinations.id", "=", "trips.destination_id")
            .leftJoin("user_trips", "user_trips.trip_id", "=", "trips.id")
            .where("trips.owner_id", req.account.accountId)
            .select(
                "trips.id as trip_id",
                "trips.trip_name",
                "trips.kid_friendly",
                "trips.trip_length",
                "trips.notes",
                "trips.destination_id",
                "destinations.place as destination",
                knex.raw("COUNT(user_trips.user_id) as num_travelers")
            )
            .groupBy("trips.id", "trips.trip_name", "destinations.place");

        res.status(200).json(trips);
    } catch (error) {
        console.error("Error retrieving trips", error);
        res.status(500).json({ error: "Internal server error" });
    }
});


router.get("/:id", authenticate, async (req, res) => {
    const tripId = req.params.id;
    try {
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
            .where("trips.owner_id", req.account.accountId);

        const usersQuery = knex("users")
            .select(
                "users.id as user_id",
                "users.first_name",
                "users.last_name",
                "users.has_kids",
                "users.special_considerations",
                "type_of_travel.type_of_travel as type_of_travel"
            )
            .leftJoin("user_destination_preferences", "users.id", "=", "user_destination_preferences.user_id")
            .leftJoin("destinations", "user_destination_preferences.destination_id", "=", "destinations.id")
            .leftJoin("type_of_travel", "users.type_of_travel_id", "=", "type_of_travel.id")
            .groupBy("users.id", "users.first_name", "users.last_name", "type_of_travel.type_of_travel")
            .innerJoin("user_trips", "users.id", "=", "user_trips.user_id")
            .where("user_trips.trip_id", tripId);

        const [trip, users] = await Promise.all([tripQuery, usersQuery]);

        // Empty result means the trip either doesn't exist or isn't owned by the
        // caller. Return the same 404 for both so ownership isn't enumerable.
        if (!trip || trip.length === 0) {
            return res.status(404).json({ error: "Trip not found" });
        }

        const tripWithUsers = {
            ...trip[0],
            users,
        };

        res.status(200).json(tripWithUsers);
    } catch (error) {
        console.error("Error retrieving trip", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.put("/:id", authenticate, async (req, res) => {
    const { id } = req.params;
    try {
        const { trip_name, kid_friendly, trip_length, destination_id, notes } = req.body;
        const kidFriendly = normalizeKidFriendly(kid_friendly);

        // notes is optional (the schema allows null); everything else is required.
        if (isEmpty(trip_name) || kidFriendly === undefined || isEmpty(trip_length) || isEmpty(destination_id)) {
            return res.status(400).json({ error: "All fields are required!" });
        } else if (isNaN(trip_length)) {
            return res.status(400).json({ error: "length is not a number!" });
        }

        const existingTrip = await knex("trips").where("id", id).first();

        // 404 when the trip is missing or owned by someone else.
        if (!existingTrip || existingTrip.owner_id !== req.account.accountId) {
            return res.status(404).json({ error: "Trip not found" });
        }

        await knex("trips")
            .where("id", id)
            .update({
                trip_name,
                kid_friendly: kidFriendly,
                trip_length,
                destination_id,
                notes,
            });
        res.status(200).json({ message: "Trip updated successfully" });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.post("/new", authenticate, async (req, res) => {
    try {
        const { trip_name, kid_friendly, trip_length, destination_id, notes } = req.body;
        const kidFriendly = normalizeKidFriendly(kid_friendly);

        if (isEmpty(trip_name) || kidFriendly === undefined || isEmpty(trip_length) || isEmpty(destination_id)) {
            return res.status(400).json({ error: "All fields are required!" });
        } else if (isNaN(trip_length)) {
            return res.status(400).json({ error: "Length is not a number!" });
        }

        const insertedTrip = await knex("trips").insert({
            trip_name,
            kid_friendly: kidFriendly,
            trip_length,
            destination_id,
            notes,
            owner_id: req.account.accountId,
        });

        res.status(201).json({ message: "Trip added successfully", trip: insertedTrip[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.delete("/:id", authenticate, async (req, res) => {
    const { id } = req.params;

    try {
        const rowsToDelete = await knex("trips")
            .where("id", id)
            .where("owner_id", req.account.accountId)
            .delete();

        if (rowsToDelete === 0) {
            // Nothing deleted: the trip doesn't exist or isn't the caller's.
            return res.status(404).json({ error: "Trip not found" });
        }

        res.sendStatus(204);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


module.exports = router;
