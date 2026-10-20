const express = require("express");
const router = express.Router();
const knex = require("../db");
const reportError = require("../utils/reportError");

router.use(express.json())

router.get("/", async (_req, res) => {
    try {
        const destinations = await knex("destinations")
        res.status(200).json(destinations);
    } catch (error) {
        reportError(req, error, "Error retrieving destinations");
        res.status(500).json({ error: "Internal server error" });
    }
})


 module.exports = router;
