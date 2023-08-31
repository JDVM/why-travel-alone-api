const express = require("express");
const router = express.Router();
const knex = require("knex")(require("../knexfile").development);

router.use(express.json())

router.get("/", async (_req, res) => {
    try {
        const travelers = await knex("trips");
        res.status(200).json(travelers);
    } catch (error) {
        console.error("Error retrieving travelers", error);
        res.status(500).json({ error: "Internal server error" });

    }
})

module.exports = router;