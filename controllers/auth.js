require('dotenv').config();

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../models');

const { errorLogger, userLogger } = require('../utils/logger.js');

/**
 * User login, handles authorisation checking and generating a token for user
 * @param {*} req The request body
 * @param {*} res The response body
 * @returns On success, the JSON web token to be used for futher auth
 */
const login = (req, res) => {
    if (!req.body.password) {
        return res.status(400).send("password not provided");
    }

    if (!req.body.email) {
        return res.status(400).send("email not provided");
    }

    db.user.findOne({
        where: {
            // Find email matching user input
            email: req.body.email
        }
    })
        .then(dbUser => {
            if (!dbUser) { // If email is not found
                return res.status(404).send("user not found");
            } else {
                bcrypt.compare(req.body.password, dbUser.pwd, (err, same) => {
                    if (same) { // Password match
                        // There is currently no implementation of token refreshing, so we made tokens long just for testing purposes
                        // Futher development MUST include implementation for refreshing expired tokens and MUST reduce the expire time as this is not secure
                        const token = jwt.sign({ user_ID: dbUser.user_ID }, process.env.SECRET, { expiresIn: '336h' }); // 2 weeks, NOT SECURE AT ALL (just for testing phase)
                        userLogger.verbose("User " + req.body.email + " logged in from IP: " + req.ip);
                        res.status(200).json({ "token": token });
                    } else if (err) { // Error
                        errorLogger.error("Login: " + err);
                        res.status(502).send("errored while checking password");
                    } else { // Password mismatch
                        res.status(401).send("invalid credentials");
                    };
                });
            };
        })
        .catch(err => {
            errorLogger.error("Login: " + err);
        });
};

/**
 * Signs a user up
 * @param {*} req The request body
 * @param {*} res The response body
 * @returns 201 code if signup is successful
 */
const signup = (req, res) => {
    if (!req.body.password) {
        return res.status(400).send("password not provided");
    }

    if (!req.body.email) {
        return res.status(400).send("email not provided");
    }

    db.user.findOne({
        where: {
            // Find email matching user input
            email: req.body.email
        }
    })
        .then(dbUser => {
            if (dbUser) {
                return res.status(409).send("user already exists");
            }

            if (req.body.password && req.body.email) {
                // Hash the password
                bcrypt.hash(req.body.password, 10, (err, pwdHash) => {
                    if (err) {
                        errorLogger.error("Signup: " + err);
                        return res.status(500).send("password hash error");
                    }

                    // Create the user
                    return db.user.create(({
                        email: req.body.email,
                        pwd: pwdHash
                    }))
                        .then(() => {
                            userLogger.verbose("User " + req.body.email + " signed up from IP: " + req.ip);
                            res.status(201).send("user signed up");
                        })
                        .catch(err => {
                            errorLogger.error("Signup: " + err);
                            res.status(502).send("error creating user");
                        });
                });
            }
        })
};

module.exports = {
    login: login,
    signup: signup
}
