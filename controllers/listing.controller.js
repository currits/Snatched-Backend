require('dotenv').config();
const Sequelize = require('sequelize');
const { Op } = require('sequelize');
const db = require('../models');
const e = require('express');
const listingDB = db.listing;
const addressDB = db.address;
const tagDB = db.tag;
const fetch = require('node-fetch');
const { getAddressObject } = require('../utils/addressParser.js');

/*
    Creates a listing given a correctly formatted address and listing information
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

  // Get user instance from decoded jwt
  let dbUser = await db.user.findByPk(req.user.user_ID);

  // Get/add address
  let dbAddress = await getAddress(req.body.address);

  if (dbAddress === 1)
    return res.status(400).send("address could not be found");

  if (dbAddress === 2)
    return res.status(502).send("bad google gateway");

  let dbListing;
  try {
    // Create the listing
    dbListing = await db.listing.create(({
      title: req.body.title,
      stock_num: req.body.stock_num,
      pickup_instructions: req.body.pickup_instructions,
      description: req.body.description,
      should_contact: req.body.should_contact
    }));

  }
  catch (err) {
    console.error(err);
    return res.status(500).send("could not create listing");
  }

  // Add tags if provided
  if (req.body.tags) {
    if (addTags(req.body.tags, dbListing) === 1)
      return res.status(500).send("could not add tags")
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
    return res.status(500).send("could not associate models")
  }
  // Return created listings ID
  res.status(201).json({ listing_ID: dbListing.listing_ID });
}

// Controller to handle retrieving multiple listings from the database
// Needs GET query (as ?key=value) params:
//    lat: latitude of a center point of a square to search within
//    lon: longitude of a center point of a square to search within
// Returns JSON array of listings with; listing_ID,title, desc, stock num, pickup_instructions, and the lat and lon for each (for displaying on map)
exports.getMany = async (req, res) => {
  //this needs to be expanded to changed to send
  //  -only listing IDs and title, leave individual (ie marker taps) to findByPk method
  var latlon = { lat: parseFloat(req.query.lat), lon: parseFloat(req.query.lon) };
  //code for calculating circle distances would go here, centre point coords stored in req.body.lat and req.body.lon
  //ideally results in assoc array with fields pos1, pos2 to dentote two lat/lon points (bottom left and top right) that form a square for us to check within
  //for now, just search within an inflated square, with sides approx 22km long
  var pos1 = { lat: latlon.lat - 0.1, lon: latlon.lon - 0.1 };
  var pos2 = { lat: latlon.lat + 0.1, lon: latlon.lon + 0.1 };

  try {
    //this retrieves an array of address instances
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
    console.error(err);
    return res.status(500).send("server error finding addresses")
  }

  //first see if we actually retrieved stored addresses
  if (!addressResults)
    return res.status(204);

  //if we did, attempt to retrieve every listing associated with each address
  console.log(addressResults.length);
  try {
    //promise all so we wait until all results are retrieved before sending data
    var listingResults = await Promise.all(await addressResults.map(async x => {
      //check if listings exist
      var listingCount = await x.countListings();
      if (listingCount > 0) {
        //get them
        var listingsAtAddress = await x.getListings();
        //and for each of the found listings, create a json with the listings coords and tags attached
        return (listingsAtAddress.map(y => {
          console.log("inside 3");
          var processedListing = y.toJSON();
          processedListing["lat"] = x.lat;
          processedListing["lon"] = x.lon;
          //store the final assembled json object
          return (processedListing);
        }));
      }
    }));
  }
  catch (err) {
    console.error(err);
    return res.status(500).send("server error getting listings")
  }


  if (listingResults.length == 0)
    return res.status(204);
  else {
    listingResults = listingResults.flat()
    res.status(200).send(listingResults); console.log("end reached");
  }
};

// Controller to retrieve a single listing
// Address GET request to "/listing/id" where id is the listing ID.
// Returns a single JSON object containing a listings: title, desc, stock_num, pickup instructions, lat, lon,
// full address (single string) and tags (as a single string, comma deliminated), and the user ID of the 
// user (producer) that created the listing (currrently just sends userID, could also include user contact deets but would prefer
// to not eager load user deets re privacy)
exports.getOne = async (req, res) => {
  var listingID = req.params.id;
  try {
    var listing = await listingDB.findByPk(listingID);
  }
  catch (err) {
    console.error(err);
    return res.status(500).send("server error retrieving listing")
  }
  if (!listing)
    return res.status(204); // No listing found

  try {
    var tags = await listing.getTags();
    var address = await listing.getAddress();
    var listingCreator = await listing.getUser();
    var responseObject = listing.toJSON();
  }
  catch (err) {
    console.error(err);
    return res.status(500).send("server error while getting listing relations")
  }

  if (tags != null) {
    var tagString = "";
    tags.forEach(z => tagString += "," + z.tag);
    tagString = tagString.slice(1);
    responseObject["tags"] = tagString;
  }

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

// Controller for retreiving search results from tags and keywords
// Needs GET query (as ?key=value pairs) params:
//    tags: comma deliminated list of tags to search
//    keywords: comma deliminated list of keywords to search
// Returns
// All listings that contain the passed tags or keywords, inclusive.
// Listing data will include ID's, stock, pickup, title, desc, date created, date updated, and addressID
exports.getSearchResults = async (req, res) => {
  //first we'll need to extract keywords
  var keywords = req.query.keywords;
  var tags = req.query.tags;

  if ((keywords == null) && (tags == null)) // Missing search terms
    return res.status(400).send("Must be searching by at least one tag or keyword.")

  var tagsList = [];
  var keywordList = [];
  var searchResults = [];
  //if there are keywords, collect them
  if (keywords != null) {
    //going to assume we have seperated keywords by ','
    console.log(keywords);
    keywordList = keywords.split(',');
    console.log(keywordList);
    //setting up for pattern matching
    keywordList = keywordList.map(item => {
      return ({ [Op.or]: [{ description: { [Op.like]: '%' + item + '%' } }, { title: { [Op.like]: '%' + item + '%' } }] });
    });

    try {
      //collect all listings that contain the keywords anywhere in their title or description
      var keywordResults = await listingDB.findAll({
        where: {
          [Op.or]: keywordList
        }
      });
    }
    catch (err) {
      console.error(err);
      return res.status(500).send("errored searching with keywords")
    }
    searchResults = searchResults.concat(keywordResults);
  }

  //if there are tags, collect them
  if (tags != null) {
    //going to assume we have seperated tags by ','
    console.log(tags);
    tagsList = tags.split(',');
    console.log(tagsList);
    //setting up for pattern matching
    tagsList = tagsList.map(item => {
      return ({ tag: { [Op.like]: '%' + item + '%' } });
    });

    try {
      //collect all tags matching
      var tagResults = await tagDB.findAll({ where: { [Op.or]: tagsList } });
    }
    catch (err) {
      console.error(err);
      return res.status(500).send("errored finding tags")
    }

    try {
      //get all listings associated with those tags
      var listingsWithTags = await Promise.all(await tagResults.map(async x => {
        var result = await x.getListings();
        return (result);
      }));
    }
    catch (err) {
      console.error(err);
      return res.status(500).send("errored searching by tags")
    }

    //flatten the array
    listingsWithTags = listingsWithTags.flat();
    var uniqueID = [];
    //filter out duplicates
    listingsWithTags = listingsWithTags.filter((item) => {
      if (uniqueID.includes(item.listing_ID)) {
        return false;
      }
      else {
        uniqueID.push(item.listing_ID);
        return true;
      }
    });

    searchResults = searchResults.concat(listingsWithTags);
  }

  try {
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
    console.error(err);
    return res.status(500).send("errored collating final results")
  }

  if (searchResults.length == 0)
    res.status(204);
  else
    res.status(200).send(finalResults);
}

exports.getOwnListings = async (req, res) => {
  console.log("ownListing inside 0");
  if (req.user.user_ID) {
    const id = req.user.user_ID;
    console.log("ownListing inside 1", id);
    var ownListings = await db.listing.findAll({
      where: {
        userUserID: id
      }
    }
    );

    if (!ownListings)
      return res.status(204);

    console.log(ownListings);
    var finalResults = await Promise.all(await ownListings.map(async x => {
      var result = x.toJSON();
      var tags = await x.getTags();
      if (tags) {
        var tagString = "";
        tags.forEach(z => tagString += "," + z.tag);
        tagString = tagString.slice(1);
        result["tags"] = tagString;
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
    console.log("listing own inside last")
    res.status(200).send(finalResults);
  }
  else
    res.status(500).send("Error retrieving user's listing")

}

// Controller for Deleting a listing
// Needs DELETE request in the same form as getOne; address to listing/id where id is the listing.listing_id to delete
// Returns the listing anyway.
exports.deleteListing = async (req, res) => {
  try {
    var listingID = req.params.id;
    var listing = await listingDB.findByPk(listingID);

    if (!listing)
      return res.status(404).send("The requested listing was not found. It may have already been deleted.");

    if (listing.userUserID != req.user.user_ID)
      return res.status(403).send("you may only delete your own listings")

    await listing.destroy();
    res.status(200).send(listing);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server error performing delete request.");
  }
}

exports.updateListing = async (req, res) => {
  // Find listing
  var listingID = req.params.id;
  var listing = await listingDB.findByPk(listingID);

  // If no listing, return missing
  if (!listing)
    return res.status(404).send("The specified listing was not found.");

  // Set new changes if found  
  if (req.body.title) listing.title = req.body.title;
  if (req.body.description) listing.description = req.body.description;
  if (req.body.stock_num) listing.stock_num = req.body.stock_num;
  if (req.body.pickup_instructions) listing.pickup_instructions = req.body.pickup_instructions;
  if (req.body.should_contact) listing.should_contact = req.body.should_contact;

  // Set new tags
  if (req.body.tags) {
    // Remove tags first
    await listing.removeTags();

    // Add the tags
    if (addTags(req.body.tags, listing) === 1)
      return res.status(500).send("could not add tags")
  }

  if (req.body.address) {
    let dbAddress = getAddress(req.body.address); // Get/add address

    if (dbAddress === 1)
      return res.status(400).send("address could not be found");

    if (dbAddress === 2)
      return res.status(502).send("bad google gateway");

    await listing.setAddress(dbAddress);
  }

  await listing.save();
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
    console.error(err);
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
    console.error(err);
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
