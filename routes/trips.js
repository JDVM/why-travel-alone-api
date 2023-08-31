const express = require("express");
const router = express.Router();
const knex = require("knex")(require("../knexfile").development);

router.get("/", async (_req, res) => {
    try {
        const trips = await knex("trips");
        res.status(200).json(trips);
    } catch (error) {
        console.error("Error retrieving trips", error);
        res.status(500).json({ error: "Internal server error" });

    }
})

module.exports = router;