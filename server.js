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

// Make DB associations
db.user.hasMany(db.listing);
db.listing.belongsTo(db.user);

db.address.hasMany(db.listing);
db.listing.belongsTo(db.address);

db.listing.belongsToMany(db.tag, { through: 'ListingTags' });
db.tag.belongsToMany(db.listing, { through: 'ListingTags' });

// SYNC DECIMATES DATABASE, USE ONLY IF U NEED TO
// FORCE: TRUE DROPS ALL TABLES
//db.sequelize.sync({ force: true });

console.log("Server listening on port: " + process.env.PORT);
server.listen(process.env.PORT);