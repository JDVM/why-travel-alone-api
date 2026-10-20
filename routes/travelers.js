const express = require("express");
const router = express.Router();
const knex = require("../db");
const authenticate = require("../middleware/authenticate");
const { parseId } = require("../utils/validate");
const { privateViewIds, forViewer } = require("../utils/travelers");

// Travelers are the site's users, so the directory needs a login. Who can see
// a traveler's private fields is decided by forViewer (utils/travelers.js).
// Adding people to trips happens through invitations (routes/trips.js).
router.use(authenticate);

function travelersQuery() {
    return knex
        .select(
            "users.id as user_id",
            "users.first_name",
            "users.last_name",
            "users.has_kids",
            "users.special_considerations",
            "type_of_travel.type_of_travel as type_of_travel",
            knex.raw("JSON_ARRAYAGG(destinations.place) as preferred_destinations")
        )
        .from("users")
        .leftJoin("user_destination_preferences", "users.id", "=", "user_destination_preferences.user_id")
        .leftJoin("destinations", "user_destination_preferences.destination_id", "=", "destinations.id")
        .leftJoin("type_of_travel", "users.type_of_travel_id", "=", "type_of_travel.id")
        .groupBy("users.id", "users.first_name", "users.last_name", "type_of_travel.type_of_travel");
}

router.get("/", async (req, res) => {
    try {
        const [travelers, visibleIds] = await Promise.all([
            travelersQuery(),
            privateViewIds(req.account.accountId),
        ]);
        res.status(200).json(travelers.map((traveler) => forViewer(traveler, visibleIds)));
    } catch (error) {
        console.error("Error retrieving travelers", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.get("/:id", async (req, res) => {
    const travelerId = parseId(req.params.id);
    if (!travelerId) {
        return res.status(404).json({ error: "Traveler not found" });
    }
    try {
        const traveler = await travelersQuery().where("users.id", travelerId).first();
        if (!traveler) {
            return res.status(404).json({ error: "Traveler not found" });
        }
        const visibleIds = await privateViewIds(req.account.accountId);
        res.status(200).json(forViewer(traveler, visibleIds));
    } catch (error) {
        console.error("Error retrieving traveler", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

module.exports = router;
