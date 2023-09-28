const express = require('express');
const router = express.Router();
const { login, signup } = require('../controllers/auth.js');
const { createListing } = require('../controllers/createListing.js');
const { verifyToken } = require('../middleware/auth.js');
const { editUser, getUser } = require('../controllers/userController.js');
const listings = require("../controllers/listing.controller.js");

/// User Auth
router.post("/login", login);
router.post("/signup", signup);
router.get("/listing/", listings.getMany);
router.get("/listing/:id", listings.getOne);
router.get("/listing/search", listings.getSearchResults);

/// Auth required routes
router.post("/listing/create", verifyToken, createListing);
router.put("/user", verifyToken, editUser);
router.get("/user/:id", verifyToken, getUser);
router.get("/user", verifyToken, getUser);

module.exports = router;