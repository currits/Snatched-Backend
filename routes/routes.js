const express = require('express');
const router = express.Router();
const { login } = require('../controllers/auth.js');

// User Auth
router.post("/login", login);

module.exports = router;