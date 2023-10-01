const express = require('express');
const router = express.Router();
const { login, signup } = require('../controllers/auth.js');
const { verifyToken } = require('../middleware/auth.js');
const { editUser, getUser } = require('../controllers/userController.js');
const listings = require("../controllers/listing.controller.js");

/// User Auth
router.post("/login", login);
router.post("/signup", signup);

/// Auth required routes
router.post("/listing/create", verifyToken, listings.createListing);
// For getting listings in an area. Submit with lat and lon key value pairs.
router.get("/listing/", verifyToken, listings.getMany);
// For getting a single listing. Submit id as part of url.
router.get("/listing/:id", verifyToken, listings.getOne);
// For getting a user's own listings
router.get("/own", verifyToken, listings.getOwnListings);
// For deleting a single listing. Submit id as part of url.
router.delete("/listing/:id", verifyToken, listings.deleteListing);
// For updating a single listing. Submit id as part of url, new data as part of body.
router.put("/listing/:id", verifyToken, listings.updateListing);
// For searching listings accoridng to keywords and tags. Submit keywords and tags as key value pairs.
router.get("/search", verifyToken, listings.getSearchResults);
router.put("/user", verifyToken, editUser);
router.get("/user/:id", verifyToken, getUser);
router.get("/user", verifyToken, getUser);

module.exports = router;