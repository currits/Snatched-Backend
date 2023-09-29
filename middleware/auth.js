require('dotenv').config();
const jwt = require("jsonwebtoken");

/*
    Verifies json web token is legit and attatches decoded token to request
*/
const verifyToken = (req, res, next) => {

    let token;

    if (!req.headers.authorization)
        return res.status(403).send("Missing token");

    try {
        token = req.headers.authorization.split(' ')[1];
    }
    catch (err) {
        console.error(err);
        return res.status(400).send("Failed to read token");
    }

    if (!token) {
        return res.status(403).send("Missing Token");
    }

    try {
        const decoded = jwt.verify(token, process.env.SECRET);
        req.user = decoded;
    } catch (err) {
        console.log(token);
        return res.status(401).send("Invalid Token");
    }

    next();
}

module.exports = {
    verifyToken: verifyToken
}