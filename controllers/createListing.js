require('dotenv').config();
const db = require('../models');
const fetch = require('node-fetch');
const { getAddressObject } = require('../utils/addressParser.js');

/*
    Creates a listing given a correctly formatted address and listing information
*/
async function createListing(req, res) {
    // Check for address in body
    if (!req.body.address) {
        return res.status(400).send("missing address");
    }

    // Check that all listing components are sent
    if (!req.body.title || !req.body.description || !req.body.pickup_instructions) {
        return res.status(400).send("missing listing component");
    }

    // URI formatting for fetching geocode response
    const address = req.body.address;
    const URL = 'https://maps.googleapis.com/maps/api/geocode/json?address=' + encodeURIComponent(address) + '&key=' + process.env.GOOGLE_KEY;

    let data;
    // Get geocode data
    try {
        data = await fetch(URL);
    }
    catch (err) {
        console.error(err);
        return res.status(502).send("bad google gateway")
    }

    const jsonAddress = await data.json();

    // If address not found, return bad response
    if (jsonAddress.status === "ZERO_RESULTS") {
        return res.status(400).send("address not found");
    }

    // Find if the address already exists in db
    let dbAddress = await db.address.findOne({
        where: {
            place_ID: jsonAddress.results[0].place_id
        }
    });

    // Get user instance from decoded jwt
    let dbUser = await db.user.findOne({
        where: {
            user_ID: req.user.user_ID
        }
    });

    try {
        // If the address doesnt exist, create it
        if (!dbAddress) {
            // Parse google response into pretty object
            const addressComponents = getAddressObject(jsonAddress.results[0].address_components);
            dbAddress = await db.address.create(({
                place_ID: jsonAddress.results[0].place_id,
                street_no: addressComponents.street_no,
                street_name: addressComponents.street,
                town_city: addressComponents.city,
                country: addressComponents.country,
                postcode: addressComponents.postcode,
                lat: jsonAddress.results[0].geometry.location.lat,
                lon: jsonAddress.results[0].geometry.location.lng
            }));
        }
    }
    catch (err) {
        console.error(err);
        return res.status(500).send("could not create address");
    }

    try {
        // Create the listing
        let dbListing = await db.listing.create(({
            title: req.body.title,
            stock_num: req.body.stock_num,
            pickup_instructions: req.body.pickup_instructions,
            description: req.body.description
        }));

    }
    catch (err) {
        console.error(err);
        return res.status(500).send("could not create listing");
    }

    try {
        // Add tags if provided
        if (req.body.tags) {
            const tags = req.body.tags;

            tags.forEach(async _tag => {
                let dbTag = await db.tag.findOne({
                    where: {
                        tag: _tag
                    }
                })

                if (!dbTag) {
                    dbTag = await db.tag.create(({
                        tag: _tag
                    }));
                }

                await dbListing.addTag(dbTag);
                await dbTag.addListing(dbListing);
            });
        }

    }
    catch (err) {
        console.error(err);
        return res.status(500).send("could not create tags");
    }

    try {
        // Associate listing with user and address
        await dbListing.setUser(dbUser);
        await dbListing.setAddress(dbAddress);

        // Associate user and address with listing
        await dbUser.addListing(dbListing);
        await dbAddress.addListing(dbListing);
    }
    catch (err) {
        console.error(err);
        res.status(500).send("could not associate models")
    }
    // Return created listings ID
    res.status(201).json({ listing_ID: dbListing.listing_ID });
}

module.exports = {
    createListing: createListing
}