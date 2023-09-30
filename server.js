require('dotenv').config();

const helmet = require('helmet');
const express = require('express');
const router = require('./routes/routes.js')
const db = require('./models');
const https = require('https');
const fs = require('fs');

const server = express();

// Enable Cloudflare HTTPS
// From: https://saturncloud.io/blog/how-to-use-express-cloudflare-with-ssl-for-secure-web-applications/#step-4-update-express-app
//server.enable('trust proxy');

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
// ALTER: TRUE WILL MESS WITH CHANGED TABLES
//db.sequelize.sync({ alter: true });

const privateKey = fs.readFileSync('./certs/privkey.pem', 'utf8');
const certificate = fs.readFileSync('./certs/cert.pem', 'utf8');
const ca = fs.readFileSync('./certs/chain.pem', 'utf8');

const credentials = {
    key: privateKey,
    cert: certificate,
    ca: ca
};

// Starting https server
const httpsServer = https.createServer(credentials, server);

httpsServer.listen(process.env.PORT, () => {
    console.log("Server listening on port: " + process.env.PORT);
});
