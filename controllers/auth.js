require('dotenv').config();

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../models');

const login = (req, res, next) => {
    db.user.findOne({
        where: {
            email: req.body.email
        }
    })
        .then(dbUser => {
            if (!dbUser) {
                return res.status(404).json({ message: "user not found" });
            } else {
                bcrypt.compare(req.body.password, dbUser.pwd, (err, same) => {
                    if (same) {
                        const token = jwt.sign({ user_ID: dbUser.user_ID }, process.env.SECRET, { expiresIn: '1h' });
                        res.status(200).json({ message: "logged in", "token": token });
                    } else if (err) {
                        res.status(502).json({ message: "errored while checking password" });
                    } else {
                        res.status(401).json({ message: "invalid credentials" });
                    };
                });
            };
        })
        .catch(err => {
            console.log('error', err);
        });
};

module.exports = {
    login: login
}
