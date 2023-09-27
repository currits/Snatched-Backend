require('dotenv').config();
const db = require('../models');

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

        res.status(204);
    }
    catch (err) {
        console.error(err);
        return res.status(500).send("error updating user");
    }
}

module.exports = {
    editUser: editUser
}