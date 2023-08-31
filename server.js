const express = require('express')
const router = express.Router();
const app = express();
const knex = require('knex');
const knexConfig = require('./knexfile');
require('dotenv').config();
app.use(express.json())

const travelerRoutes = require("./routes/travelers");
const tripsRoutes = require("./routes/trips");

app.use("/travelers", travelerRoutes);
app.use("/trips", tripsRoutes);

const PORT = process.env.PORT ||5050;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });