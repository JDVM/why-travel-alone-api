const express = require("express");
const router = express.Router();
const knex = require("../db");
const reportError = require("../utils/reportError");

// Choices for the profile's travel type.
router.get("/", async (_req, res) => {
    try {
        const types = await knex("type_of_travel").select("id", "type_of_travel").orderBy("type_of_travel");
        res.status(200).json(types);
    } catch (error) {
        reportError(req, error, "Error retrieving travel types");
        res.status(500).json({ error: "Internal server error" });
    }
});

module.exports = router;
