const express = require("express");
const router = express.Router();
const knex = require("knex")(require("../knexfile").development);

router.use(express.json())

router.get("/", async (_req, res) => {
    try {
        const destinations = await knex("destinations")
        res.status(200).json(destinations);
    } catch (error) {
        console.error("Error retrieving destinations", error);
        res.status(500).json({ error: "Internal server error" });
    }
})


 module.exports = router;
