require('dotenv').config();

const helmet = require('helmet');
const express = require('express');
const router = require('./routes/routes.js')
const db = require('./models');

const server = express();

// Basic security
server.use(helmet());

server.use(express.urlencoded({ extended: true }));

server.use(express.json());

server.use(router)

//db.sequelize.sync();
console.log("Server listening on port: " + process.env.PORT);
server.listen(process.env.PORT);