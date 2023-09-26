const express = require('express');
const router = express.Router();
const { login, signup } = require('../controllers/auth.js');
const { createListing } = require('../controllers/createListing.js');
const { verifyToken } = require('../middleware/auth.js');

// User Auth
router.post("/login", login);
router.post("/signup", signup);

// Auth required routes
router.post("/listing/create", verifyToken, createListing);

module.exports = router;