require('dotenv').config();

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../models');

// User Login
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
                        const token = jwt.sign({ user_ID: dbUser.user_ID }, process.env.SECRET, { expiresIn: '336h' }); // 2 weeks, NOT SECURE AT ALL
                        res.status(200).json({ "token": token });
                    } else if (err) { // Error
                        console.log(err);
                        res.status(502).send("errored while checking password");
                    } else { // Password mismatch
                        res.status(401).send("invalid credentials");
                    };
                });
            };
        })
        .catch(err => {
            console.log('error', err);
        });
};

// User signup
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
                        return res.status(500).send("password hash error");
                    }

                    // Create the user
                    return db.user.create(({
                        email: req.body.email,
                        pwd: pwdHash
                    }))
                        .then(() => {
                            res.status(201).send("user signed up");
                        })
                        .catch(err => {
                            console.log(err);
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
