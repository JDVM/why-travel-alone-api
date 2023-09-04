const express = require("express");
const router = express.Router();
const knex = require("knex")(require("../knexfile").development);

router.get("/", async (_req, res) => {
    try {
        const trips = await knex("trips")
            .leftJoin("destinations", "destinations.id", "=", "trips.destination_id")
            .leftJoin("user_trips", "user_trips.trip_id", "=", "trips.id")
            .select(
                "trips.id as trip_id",
                "trips.trip_name",
                "trips.kid_friendly",
                "trips.trip_length",
                "trips.notes",
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


router.get("/:id", async (req, res) => {
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
                "destinations.place as destination"
            )
            .where("trips.id", tripId);

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

router.put("/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const { trip_name, kid_friendly, trip_length, destination_id, notes } = req.body;

        console.log(trip_name)
        console.log(kid_friendly)
        console.log(trip_length)
        console.log(notes)
        console.log(destination_id)
        console.log(req.body)

        if (!trip_name || !kid_friendly || !trip_length || !notes || !destination_id) {
            return res.status(400).json({ error: "All fields are required!" });
        } else if (isNaN(trip_length)) {
            return res.status(400).json({ error: "length is not a number!" });
        }
        const existingTrip = await knex('trips')
            .where("id", id)
            .first()

        if (!existingTrip) {
            return res.status(404).json({ error: "Trip not found" });
        }

        await knex("trips")
            .where("id", id)
            .update({
                trip_name, kid_friendly, trip_length, destination_id, notes
            })
        res.status(200).json({ message: 'Trip updated successfully' });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
})

router.post("/new", async (req, res) => {
    try {
        const { trip_name, kid_friendly, trip_length, destination_id, notes } = req.body;

        if (!trip_name || !kid_friendly || !trip_length || !notes || !destination_id) {
            return res.status(400).json({ error: "All fields are required!" });
        } else if (isNaN(trip_length)) {
            return res.status(400).json({ error: "Length is not a number!" });
        }

        const existingTrip = await knex('trips')
            .where("trip_name", trip_name)
            .first();

        if (existingTrip) {
            return res.status(409).json({ error: "Trip with the same name already exists" });
        }

        const insertedTrip = await knex("trips")
            .insert({
                trip_name, kid_friendly, trip_length, destination_id, notes
            });

        res.status(201).json({ message: 'Trip added successfully', trip: insertedTrip[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.delete("/:id", async (req, res) => {
    const { id } = req.params;

    try {
        const rowsToDelete = await knex("trips")
            .where("id", id)
            .delete();

        if (!rowsToDelete === 0) {
            throw new Error(`Failed to delete Trip ID ${id}`);
        } else {
            res.sendStatus(204);
            console.log("Delete successful");
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}); 


module.exports = router;

