require('dotenv').config();
const db = require('../models');
const { errorLogger } = require('../utils/logger.js');

/**
 * Gets a users information given their ID
 * @param {} req The request body
 * @param {*} res The response body
 * @returns The specified users ID, email, phone and username in JSON format
 */
async function getUser(req, res) {
    const id = req.params.id ? req.params.id : req.user.user_ID;

    try {
        var dbUser = await db.user.findByPk(id);
    }
    catch (err) {
        errorLogger.error("Get user: " + err);
        return res.status(500).send("error finding user");
    }

    if (dbUser)
        res.status(200).send({
            "user_ID": dbUser.user_ID,
            "email": dbUser.email,
            "phone": dbUser.phone_num,
            "username": dbUser.username
        });
    else
        res.status(404).send("could not find user");
}

/**
 * Edits a users information depending on information specified
 * @param {*} req The request body
 * @param {*} res The response body
 * @returns 204 response on success
 */
async function editUser(req, res) {
    try {
        let dbUser = await db.user.findOne({
            where: {
                user_ID: req.user.user_ID
            }
        });

        let newName = req.body.name ? req.body.name : dbUser.username;
        let newEmail = req.body.email ? req.body.email : dbUser.email;
        let newPhone = req.body.phone ? req.body.phone : dbUser.phone_num;

        dbUser.set({
            username: newName,
            phone_num: newPhone,
            email: newEmail
        })

        await dbUser.save();

        res.status(204).send("Success updating user.");
    }
    catch (err) {
        errorLogger.error("Edit user: " + err);
        return res.status(500).send("error updating user");
    }
}

module.exports = {
    editUser: editUser,
    getUser: getUser
}