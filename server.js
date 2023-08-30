const express = require('express')
const router = express.Router();
const app = express();
const knex = require('knex');
const knexConfig = require('./knexfile');
require('dotenv').config();


const travelerRoutes = require("./routes/travelers");
router.use("/travelers", travelerRoutes);

const tripsRoutes = require("./routes/trips");
router.use("/trips", tripsRoutes);

const PORT = process.env.PORT ||5050;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });