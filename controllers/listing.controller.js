require('dotenv').config();
const { Op } = require('sequelize');
const sequelize = require('sequelize');
const db = require('../models');
const listingDB = db.listing;
const addressDB = db.address;
const tagDB = db.tag;
const fetch = require('node-fetch');
const { getAddressObject } = require('../utils/addressParser.js');
const { listingLogger, errorLogger } = require('../utils/logger.js');

/**
  Creates a listing given a correctly formatted address and listing information
  @param {*} req Request body
  @param {*} res Response object
  @returns The listing id for the lsiting created
*/
exports.createListing = async (req, res) => {
  // Check for address in body
  if (!req.body.address) {
    return res.status(400).send("missing address");
  }

  // Check that all listing components are sent
  if (!req.body.title || !req.body.description || !req.body.pickup_instructions) {
    return res.status(400).send("missing listing component");
  }

  try {
    // Get user instance from decoded jwt
    var dbUser = await db.user.findByPk(req.user.user_ID);
  }
  catch (err) {
    errorLogger.error("Create listing: " + err);
    return res.status(500).send("server error finding user")
  }

  try {
    // Get/add address
    var dbAddress = await getAddress(req.body.address);
  }
  catch (err) {
    errorLogger.error("Create listing: " + err);
    return res.status(500).send("server error getting address")
  }

  if (dbAddress === 1)
    return res.status(400).send("address could not be found");

  if (dbAddress === 2)
    return res.status(502).send("bad google gateway");

  try {
    // Create the listing
    var dbListing = await db.listing.create(({
      title: req.body.title,
      stock_num: req.body.stock_num,
      pickup_instructions: req.body.pickup_instructions,
      description: req.body.description,
      should_contact: req.body.should_contact
    }));

  }
  catch (err) {
    errorLogger.error("Create listing: " + err);
    return res.status(500).send("could not create listing");
  }

  // Add tags if provided
  if (req.body.tags) {
    if (addTags(req.body.tags, dbListing) === 1) {
      dbListing.destroy();
      errorLogger.error("Create listing: " + err);
      return res.status(500).send("could not add tags");
    }
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
    errorLogger.error("Create listing: " + err);
    dbListing.destroy();
    return res.status(500).send("could not associate models")
  }

  listingLogger.verbose("Listing Created:" + JSON.stringify(dbListing, null, 2));

  // Return created listings ID
  res.status(201).json({ listing_ID: dbListing.listing_ID });
}

/**
 * Controller to handle retrieving multiple listings from the database
 * Needs GET query (as ?key=value) params: lat=latitude of a center point of a square to search within, lon=longitude of a center point of a square to search within
 * @param {*} req Request body
 * @param {*} res Response object
 * @returns JSON array of listings with; listing_ID,title, desc, stock num, pickup_instructions, and the lat and lon for each
 */
exports.getMany = async (req, res) => {
  var latlon = { lat: parseFloat(req.query.lat), lon: parseFloat(req.query.lon) };
  // Ideal implementation would be to search within a define-able area using Haversine formula
  // Alas, currently searching within a rectangular polygon. Hoping for the best.
  // Coords are kept in assoc array with fields pos1, pos2 to dentote two lat/lon points (bottom left and top right) that form a square for us to check within
  // Searches within an inflated square, with sides hardcoded as approx 22km long
  var pos1 = { lat: latlon.lat - 0.1, lon: latlon.lon - 0.1 };
  var pos2 = { lat: latlon.lat + 0.1, lon: latlon.lon + 0.1 };

  try {
    // This retrieves an array of address instances
    // We will poll each address instance for associated listings at those addresses
    // And return the listings
    var addressResults = await addressDB.findAll({
      where: {
        [Op.and]: [
          {
            lat: {
              [Op.between]: [pos1.lat, pos2.lat]
            }
          },
          {
            lon: {
              [Op.between]: [pos1.lon, pos2.lon]
            }
          }
        ]
      }
    });
  }
  catch (err) {
    errorLogger.error("Get many: " + err);
    return res.status(500).send("server error finding addresses")
  }

  // Check if we actually retrieved stored addresses
  if (!addressResults)
    return res.status(204).send();

  // If we did, attempt to retrieve every listing associated with each address
  try {
    // Promise all so we wait until all results are retrieved before sending data
    var listingResults = await Promise.all(await addressResults.map(async x => {
      // Check if listings exist
      var listingCount = await x.countListings();
      console.log(listingCount);
      if (listingCount > 0) {
        // Get them
        var listingsAtAddress = await x.getListings();
        // And for each of the found listings, create a json with the listing's coords attached
        return (listingsAtAddress.map(y => {
          var processedListing = y.toJSON();
          processedListing["lat"] = x.lat;
          processedListing["lon"] = x.lon;
          // Store the final assembled json object
          return (processedListing);
        }));
      }
      else return null;
    }));
    // The results will include null items (where an address exists in the db but no associated listings)
    // So we need to remove them
    listingResults = listingResults.filter(x => x != null);
  }
  catch (err) {
    errorLogger.error("Get many: " + err);
    return res.status(500).send("server error getting listings")
  }

  // If nothing found, return nothing found status
  if (listingResults.length == 0)
    return res.status(204).send();
  else {
    listingResults = listingResults.flat()
    res.status(200).send(listingResults);
  }
};

/**
 * Controller to retrieve a single listing.
 * Address GET request to "/listing/id" where id is the listing ID.
 * @param {*} req Request body
 * @param {*} res Response object
 * @returns single JSON object containing all data about a listing
 */
exports.getOne = async (req, res) => {
  // Use the passed listing id to retrieve the listing
  var listingID = req.params.id;
  try {
    var listing = await listingDB.findByPk(listingID);
  }
  catch (err) {
    errorLogger.error("Get one: " + err);
    return res.status(500).send("server error retrieving listing");
  }
  if (!listing)
    return res.status(204).send();; // No listing found

  // Get all rows from tables associated with this listing
  try {
    var tags = await listing.getTags();
    var address = await listing.getAddress();
    var listingCreator = await listing.getUser();
    var responseObject = listing.toJSON();
  }
  catch (err) {
    errorLogger.error("Get one: " + err);
    return res.status(500).send("server error while getting listing relations");
  }

  // Add the tags to the response
  if (tags != null) {
    tags = tags.map(z => { return z.toJSON().tag });
    responseObject["tags"] = tags;
  }
  // Add everything else
  var addressString = "";
  if (address.unit_no != null)
    addressString += " " + address.unit_no;
  if (address.street_no != null)
    addressString += " " + address.street_no;
  if (address.street_name != null)
    addressString += " " + address.street_name;
  if (address.town_city != null)
    addressString += " " + address.town_city;
  addressString = addressString.slice(1);
  responseObject["address"] = addressString;
  responseObject["lat"] = address.lat;
  responseObject["lon"] = address.lon;
  responseObject["producerID"] = listingCreator.user_ID;

  res.status(200).send(responseObject);
};

/**
 * Controller for retreiving search results from tags and keywords
 * Needs GET query (as ?key=value pairs) params: tags=comma deliminated list of tags to search, keywords=comma deliminated list of keywords to search
 * @param {*} req Request body
 * @param {*} res Response object
 * @returns All listings that contain the passed tags or keywords, inclusive.
 */
exports.getSearchResults = async (req, res) => {
  // Extract keywords, tags
  var keywords = req.query.keywords;
  var tags = req.query.tags;
  if ((!keywords && !tags) || (keywords == '' && tags == '')) // Missing search terms
    return res.status(400).send("Must be searching by at least one tag or keyword.")

  var tagsList = [];
  var keywordList = [];
  // If there are keywords, collect them
  if (keywords != null) {
    // Assume we have seperated keywords by ','
    keywordList = keywords.split(',');

    // Build pattern matching wuery string for sequelize
    // See sequelize docs for how it functions
    keywordList = keywordList.map(item => {
      return ({ [Op.or]: [{ description: { [Op.like]: '%' + item + '%' } }, { title: { [Op.like]: '%' + item + '%' } }] });
    });
  }

  // If there are tags, collect them
  if (tags != null) {
    // Assume we have seperated tags by ','
    tagsList = tags.split(',');
  }

  try {
    // Now conduct search
    // Different paths for keywords&tags, keywords&!tags, !keywords&tags
    // Uses sequelize findAll() method. Consult seqeulize docs.
    if (tags && keywords) {
      var searchResults = await listingDB.findAll({
        where: {
          [Op.or]: keywordList
        },
        include: [
          {
            model: tagDB,
            where: {
              tag: { [Op.in]: tagsList }
            }
          }
        ]
      });
    } else if (tags && !keywords) {
      var searchResults = await listingDB.findAll({
        include: [
          {
            model: tagDB,
            where: {
              tag: { [Op.in]: tagsList }
            }
          }
        ]
      })
    } else if (!tags && keywords) {
      var searchResults = await listingDB.findAll({
        where: {
          [Op.or]: keywordList
        }
      });
    }
  }
  catch (err) {
    errorLogger.error("Get one: " + err);
    return res.status(500).send("server error while retrieving listings")
  }

  // If nothing found, return
  if (searchResults.length == 0)
    return res.status(204).send();

  try {
    // Get the addresses of the found listings, format everything into a final reponse array
    var finalResults = await Promise.all(await searchResults.map(async item => {
      var result = item.toJSON();
      var address = await item.getAddress();
      var addressString = "";
      if (address.unit_no != null)
        addressString += " " + address.unit_no;
      if (address.street_no != null)
        addressString += " " + address.street_no;
      if (address.street_name != null)
        addressString += " " + address.street_name;
      if (address.town_city != null)
        addressString += " " + address.town_city;
      addressString = addressString.slice(1);
      result["address"] = addressString;
      result["lat"] = address.lat;
      result["lon"] = address.lon;
      return result;
    }));
  }
  catch (err) {
    errorLogger.error("Get one: " + err);
    return res.status(500).send("errored collating final results")
  }
  // Send it
  res.status(200).send(finalResults);
}
/**
 * Controller for retrieving a user's own listings
 * Needs GET query to /own endpoint, uses auth token to resolve who the user is
 * Returns all the user's own listings, if they have any.
 * @param {*} req Request body
 * @param {*} res Response object
 * @returns List of user's own listings
 */
exports.getOwnListings = async (req, res) => {
  // Get the user id from params
  const id = req.user.user_ID;
  // Retrieve the listings from db
  try {
    var ownListings = await db.listing.findAll({
      where: {
        userUserID: id
      }
    }
    );
  }
  catch (err) {
    errorLogger.error("Get own: " + err);
    return res.status(500).send("server error finding user listings")
  }
  // If none, return
  if (ownListings.length == 0)
    return res.status(204).send();

  // Else, also collect tags and address of each listing.
  try {
    var finalResults = await Promise.all(await ownListings.map(async x => {
      var result = x.toJSON();
      var tags = await x.getTags();
      if (tags) {
        tags = tags.map(z => { return z.toJSON().tag });
        result["tags"] = tags;
      }
      var address = await x.getAddress();
      if (address) {
        var addressString = "";
        if (address.unit_no != null)
          addressString += " " + address.unit_no;
        if (address.street_no != null)
          addressString += " " + address.street_no;
        if (address.street_name != null)
          addressString += " " + address.street_name;
        if (address.town_city != null)
          addressString += " " + address.town_city;
        addressString = addressString.slice(1);
        result["address"] = addressString;
        result["lat"] = address.lat;
        result["lon"] = address.lon;
      }
      return result;
    }));
  }
  catch (err) {
    errorLogger.error("Get own: " + err);
    return res.status(500).send("errored collating final results")
  }

  console.log("listing own inside last")
  res.status(200).send(finalResults);
}

/**
 * Controller for Deleting a listing. Desctuctive, idempotent.
 * Needs DELETE request in the same form as getOne; address to listing/id where id is the listing.listing_id to delete
 * @param {*} req Request body
 * @param {*} res Response object
 * @returns The deleted listing
 */
exports.deleteListing = async (req, res) => {
  try {
    // Get listing id from params, then get the listing in the db
    var listingID = req.params.id;
    var listing = await listingDB.findByPk(listingID);
    // If none found, return
    if (!listing)
      return res.status(404).send("The requested listing was not found. It may have already been deleted.");
    // If trying to delete another user's, return
    if (listing.userUserID != req.user.user_ID)
      return res.status(403).send("you may only delete your own listings")
    // Otherwise, use sequelize destroy() method.
    await listing.destroy();
    // Log it
    listingLogger.verbose("Listing Deleted: " + JSON.stringify(listing, null, 2));
    // Send it to user.
    res.status(200).send(listing);
  } catch (error) {
    errorLogger.error("Delete listing: " + err);
    return res.status(500).send("server error deleting listing");
  }
}

/**
 * Controller for updating a listing. Idempotent.
 * Needs PUT request in the same form as getOne, "/listing/id" where id is the listing ID.
 * @param {*} req Request body
 * @param {*} res Response object
 * @returns The updated listing
 */
exports.updateListing = async (req, res) => {
  // Find listing
  var listingID = req.params.id;
  try {
    var listing = await listingDB.findByPk(listingID);
  }
  catch (err) {
    errorLogger.error("Update listing: " + err);
    return res.status(500).send("server error finding listing")
  }

  var oldListing = JSON.stringify(listing, null, 2);

  // If no listing, return missing
  if (!listing)
    return res.status(404).send("The specified listing was not found.");

  // Set new changes if found  
  if (req.body.title) listing.title = req.body.title;
  if (req.body.description) listing.description = req.body.description;
  if (req.body.stock_num) {
    if (req.body.stock_num == "-")
      listing.stock_num = null;
    else
      listing.stock_num = req.body.stock_num;
  }
  if (req.body.pickup_instructions) listing.pickup_instructions = req.body.pickup_instructions;
  if (req.body.should_contact) listing.should_contact = req.body.should_contact;

  try {
    // Set new tags
    if (req.body.tags) {
      // Remove tags first
      await listing.setTags([]);

      // Add the tags
      if (addTags(req.body.tags, listing) === 1)
        return res.status(500).send("could not add tags")
    }
  }
  catch (err) {
    errorLogger.error("Update listing: " + err);
    return res.status(500).send("server error setting tags")
  }

  try {
    if (req.body.address) {
      var dbAddress = await getAddress(req.body.address); // Get/add address

      if (dbAddress === 1)
        return res.status(400).send("address could not be found");

      if (dbAddress === 2)
        return res.status(502).send("bad google gateway");

      await listing.setAddress(dbAddress);
    }
  }
  catch (err) {
    errorLogger.error("Update listing: " + err);
    return res.status(500).send("server error updating address")
  }

  try {
    await listing.save();
  }
  catch (err) {
    errorLogger.error("Update listing: " + err);
    return res.status(500).send("server error while saving listing")
  }

  listingLogger.verbose("Listing updated from: " + oldListing + " to: " + JSON.stringify(listing, null, 2));

  res.status(204).send(listing);
}

// Adds tags to a listing
// returns 1 if errors
async function addTags(tags, listing) {
  try {
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
      await listing.addTag(dbTag);
      await dbTag.addListing(listing);
    });
  }
  catch (err) {
    errorLogger.error("Add tags: " + err);
    return 1;
  }
}

// Gets/adds an address and returns its sql instance
// Returns 1 if no address found
// Returns 2 if bad google gateway
async function getAddress(address) {
  var URL = 'https://maps.googleapis.com/maps/api/geocode/json?address=' + encodeURIComponent(address) + '&key=' + process.env.GOOGLE_KEY;
  var data;

  try {
    data = await fetch(URL);
  }
  catch (err) {
    errorLogger.error("Get address: " + err);
    return 2;
  }

  var jsonAddress = await data.json();

  if (jsonAddress.status === "ZERO_RESULTS")
    return 1;

  let dbAddress = await addressDB.findOne({
    where: {
      place_ID: jsonAddress.results[0].place_id
    }
  });

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

  return dbAddress;
}
