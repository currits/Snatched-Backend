const Sequelize = require('sequelize');
const {Op} = require('sequelize');
const db = require('../models');
const e = require('express');
const listingDB = db.listing;
const addressDB = db.address;
const tagDB = db.tag;

// Controller to handle retrieving multiple listings from the database
// Needs GET query (as ?key=value) params:
//    lat: latitude of a center point of a square to search within
//    lon: longitude of a center point of a square to search within
// Returns JSON array of listings with; listing_ID,title, desc, stock num, pickup_instructions, and the lat and lon for each (for displaying on map)
exports.getMany = async (req, res) => {
    try {
      //this needs to be expanded to changed to send
      //  -latlon data for app to place markers
      //  -only listing IDs and title, leave individual (ie marker taps) to findByPk method
      var latlon = {lat: parseFloat(req.query.lat), lon: parseFloat(req.query.lon)};
      //code for calculating circle distances would go here, centre point coords stored in req.body.lat and req.body.lon
      //ideally results in assoc array with fields pos1, pos2 to dentote two lat/lon points (bottom left and top right) that form a square for us to check within
      //for now, just search within an inflated square, with sides approx 22km long
      var pos1 = {lat: latlon.lat - 0.1, lon: latlon.lon - 0.1};
      var pos2 = {lat: latlon.lat + 0.1, lon: latlon.lon + 0.1};
    
      //this retrieves an array of address instances
      var addressResults = await addressDB.findAll({ where: {
        [Op.and] : [
          {lat: {
            [Op.between]: [pos1.lat, pos2.lat]
          }},
          {lon: {
            [Op.between]: [pos1.lon, pos2.lon]
          }}
        ]
      }});

      //first see if we actually retrieved stored addresses
      if (addressResults == null)
        //return error message if we did not
        res.status(500).send("No listings found near those coordinates.");
      else {
        //if we did, attempt to retrieve every listing associated with each address
        console.log(addressResults.length);
        //promise all so we wait until all results are retrieved before sending data
        var listingResults = await Promise.all(await addressResults.map(async x => {
          //check if listings exist
          var listingCount = await x.countListings();
          if (listingCount > 0){
            //get them
            var listingsAtAddress = await x.getListings();
            //and for each of the found listings, create a json with the listings coords and tags attached
            return(listingsAtAddress.map(y => {
              console.log("inside 3");
              var processedListing = y.toJSON();
              processedListing["lat"] = x.lat;
              processedListing["lon"] = x.lon;
              //store the final assembled json object
              return(processedListing);
            }));
          }
        }));
        if (listingResults.length == 0)
          res.status(404).send("No listings found near those coordinates.");
        else
          res.status(200).send(listingResults); console.log("end reached");
      }
    } catch (error) {
      //if we encounter a problem, return problem code
      console.log(error);
      res.status(500).send("Error retrieving listing data from server.");
    }
  };

  // Controller to retrieve a single listing
  // Address GET request to "/listing/id" where id is the listing ID.
  // Returns a single JSON object containing a listings: title, desc, stock_num, pickup instructions, lat, lon,
  // full address (single string) and tags (as a single string, comma deliminated), and the user ID of the 
  // user (producer) that created the listing (currrently just sends userID, could also include user contact deets but would prefer
  // to not eager load user deets re privacy)
  exports.getOne = async (req, res) => {
    try {
      var listingID = req.params.id;
      var listing = await listingDB.findByPk(listingID);
      if (listing != null){
        var tags = await listing.getTags();
        var address = await listing.getAddress();
        var listingCreator = await listing.getUser();
        var responseObject = listing.toJSON();

        if (tags != null){
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
      }
      else{
        res.status(404).send("No listings found.");
      }
    } catch (error) {
      res.status(500).send("Error retrieving listing data from server.");
    }
  };

  // Controller for retreiving search results from tags and keywords
  // Needs GET query (as ?key=value pairs) params:
  //    tags: comma deliminated list of tags to search
  //    keywords: comma deliminated list of keywords to search
  // Returns
  // All listings that contain the passed tags or keywords, inclusive.
  // Listing data will include ID's, stock, pickup, title, desc, date created, date updated, and addressID
  exports.getSearchResults = async (req, res) => {
    try {
      //first we'll need to extract keywords
      var keywords = req.query.keywords;
      var tags = req.query.tags;
      //if no search terms
      if ((keywords == null) && (tags == null))
        res.status(500).send("Must be searching by at least one tag or keyword.")
      else{
        //otherwise
        var tagsList = [];
        var keywordList = [];
        var searchResults = [];
        //if there are keywords, collect them
        if(keywords != null){
          //going to assume we have seperated keywords by ','
          console.log(keywords);
          keywordList = keywords.split(',');
          console.log(keywordList);
          //setting up for pattern matching
          keywordList = keywordList.map(item => {
            return ({ [Op.or] :[{description: {[Op.like] : '%' + item + '%'}}, {title : {[Op.like] : '%' + item + '%'}}]});
        });
          //collect all listings that contain the keywords anywhere in their title or description
          var keywordResults = await listingDB.findAll({
            where: {
              [Op.or] : keywordList}
              });
          searchResults = searchResults.concat(keywordResults);
        }
        //if there are tags, collect them
        if (tags != null){
          //going to assume we have seperated tags by ','
          console.log(tags);
          tagsList = tags.split(',');
          console.log(tagsList);
          //setting up for pattern matching
          tagsList = tagsList.map(item => {
            return ({tag: {[Op.like] : '%' + item + '%'}});
          });
          //collect all tags matching
          var tagResults = await tagDB.findAll({where: {[Op.or]: tagsList}});
          //get all listings associated with those tags
          var listingsWithTags = await Promise.all(await tagResults.map(async x => {
            var result = await x.getListings();
            return (result);
          }));
          //flatten the array
          listingsWithTags = listingsWithTags.flat();
          var uniqueID = [];
          //filter out duplicates
          listingsWithTags = listingsWithTags.filter((item) =>{
            if (uniqueID.includes(item.listing_ID)){
              return false;
            }
            else{
              uniqueID.push(item.listing_ID);
              return true;
            }
          });
          searchResults = searchResults.concat(listingsWithTags);
        }
        if (searchResults.length == 0)
          res.status(500).send("No results found.");
        else
          res.status(200).send(searchResults);
      }

    } catch (error) {
      console.log(error);
      res.status(500).send("Error in search function");
    }
  }

  // Controller for Deleting a listing
  // Needs DELETE request in the same form as getOne; address to listing/id where id is the listing.listing_id to delete
  // Returns the listing anyway.
  exports.deleteListing = async (req, res) => {
    try {
      var listingID = req.params.id;
      var listing = await listingDB.findByPk(listingID);
      if (listing != null){
        await listing.destroy();
        res.status(200).send(listing);
      }
      else
        res.status(404).send("The requested listing was not found. It may have already been deleted.");
    } catch (error) {
      console.log(error);
      res.status(500).send("Server error performing delete request.");
    }
  }

  exports.updateListing = async (req, res) => {
    console.log("entry");
    try {
      var listingID = req.params.id;
      var listing = await listingDB.findByPk(listingID);
      console.log("point 1");
      if (listing == null)
        res.status(404).send("The specified listing was not found.");
      else {
        console.log("point 2");
        if (req.body.title) {
          console.log("title");
          listing.title = req.body.title;
        }
        if (req.body.description) {
          console.log("desc");
          listing.description = req.body.description;
        }
        if (req.body.stock_num) {
          console.log("stock");
          listing.stock_num = req.body.stock_num;
        }
        if (req.body.pickup_instructions) {
          console.log("pickup");
          listing.pickup_instructions = req.body.pickup_instructions;
        }
        if (req.body.tags) {
          const tags = req.body.tags;
          listing.removeTags();
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
            console.log("tags");
            await listing.addTag(dbTag);
            await dbTag.addListing(listing);
          });
        }
        if (req.body.address){
          var URL = 'https://maps.googleapis.com/maps/api/geocode/json?address=' + encodeURIComponent(req.body.address) + '&key=' + process.env.GOOGLE_KEY;
          var data = await fetch(URL);
          var jsonAddress = await data.json();
          if (jsonAddress.status === "ZERO_RESULTS")
            return res.status(400).send("New address could not be found");
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
          console.log("address");
          listing.setAddress(dbAddress);
        }
        console.log("saving changes");
        listing.save();
        res.status(204).send(listing);
      }
    } catch (error) {
      console.log(error);
      res.status(500).send("Server error when trying to update listing.");
    }
  }

    //    Below is reference code from uni    //
  /*
// Controller to modify the data of a listing within the database
exports.update = (req, res) => {
  if (!req.body || !req.body.id) {
    res.status(400).send({
      message: "Content can not be empty!"
    });
  }

  var newData = {};
  if (req.body.title){
    newData.title = req.body.title;
  }
  if (req.body.desc){
    newData.desc = req.body.desc;
  }
  if (req.body.lat){
    newData.lat = req.body.lat;
  }
  if (req.body.lng){
    newData.lng = req.body.lng;
  }
  if (newData.length == 0){
    res.status(400).send({
      message: "New listing data must be provided"
    });
  }
  
  Project.update(req.body.id, newData, (err, data) =>{
        if (err)
      res.status(404).send({
        message:
          err.message || "Resource not found"
      });
      else res.status(200).send(data);
  });
};

// Controller to delete a project from within the database
exports.delete = (req, res) => {
  if (!req.body) {
    res.status(400).send({
      message: "Content can not be empty!"
    });
  }
  Project.delete(req.body.id, (err, data) => {
    if (err)
      res.status(404).send({
        message:
          err.message || "Resource not found"
      });
    else res.status(204).send({message:"Deletion Successful"});
  });
};

// Controller to delete all project data from the database
exports.deleteAll = (req, res) => {
  Project.deleteAll((err, data) => {
    if (err)
      res.status(404).send({
        message:
          err.message || "Resource not found."
      });
    else res.status(204).send({message:"Deletion Successful"});
  });
};

*/
