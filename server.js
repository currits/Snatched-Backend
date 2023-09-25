require('dotenv').config();

const helmet = require('helmet');
const express = require('express');
const router = require('./routes/routes.js')
const db = require('./models');

const server = express();

// Basic security
server.use(helmet());

// Allows urlencoded bodies to be parsed with non-strings
server.use(express.urlencoded({ extended: true }));

// Parsing json as req.body
server.use(express.json());

// Get routes
server.use(router)

// SYNC DECIMATES DATABASE, USE ONLY IF U NEED TO
//db.sequelize.sync();

console.log("Server listening on port: " + process.env.PORT);
server.listen(process.env.PORT);