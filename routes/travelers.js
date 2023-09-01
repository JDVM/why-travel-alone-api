const express = require("express");
const router = express.Router();
const knex = require("knex")(require("../knexfile").development);

router.use(express.json())

router.get("/", async (_req, res) => {
    try {
        const travelers = await knex
            .select(
                "users.id as user_id",
                "users.first_name",
                "users.last_name",
                "users.has_kids",
                "special_considerations",
                "type_of_travel.type_of_travel as type_of_travel",
                knex.raw("JSON_ARRAYAGG(destinations.place) as preferred_destinations")
            )
            .from("users")
            .leftJoin("user_destination_preferences", "users.id", "=", "user_destination_preferences.user_id")
            .leftJoin("destinations", "user_destination_preferences.destination_id", "=", "destinations.id")
            .leftJoin("type_of_travel", "users.type_of_travel_id", "=", "type_of_travel.id")
            .groupBy("users.id", "users.first_name", "users.last_name", "type_of_travel.type_of_travel");
        res.status(200).json(travelers);
    } catch (error) {
        console.error("Error retrieving travelers", error);
        res.status(500).json({ error: "Internal server error" });

    }
})

router.get("/:id", async (req, res) => {
    const travelerId = req.params.id;
    try {
        const traveler = await knex
            .select(
                "users.id as user_id",
                "users.first_name",
                "users.last_name",
                "users.has_kids",
                "special_considerations",
                "type_of_travel.type_of_travel as type_of_travel",
                knex.raw("JSON_ARRAYAGG(destinations.place) as preferred_destinations")
            )
            .from("users")
            .leftJoin("user_destination_preferences", "users.id", "=", "user_destination_preferences.user_id")
            .leftJoin("destinations", "user_destination_preferences.destination_id", "=", "destinations.id")
            .leftJoin("type_of_travel", "users.type_of_travel_id", "=", "type_of_travel.id")
            .groupBy("users.id", "users.first_name", "users.last_name", "type_of_travel.type_of_travel")
            .where("users.id", travelerId)
            .first();
        if (!traveler) {
            return res.status(404).json({ error: "Traveler not found" });
        }
        res.status(200).json(traveler)
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal server error" })
    }
});

module.exports = router;