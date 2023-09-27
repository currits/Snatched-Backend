const Sequelize = require('sequelize');
const {Op} = require('sequelize');
const db = require('../models')
const listingDB = db.listing;
const addressDB = db.address;

// Controller to handle retrieving multiple listings from the database
// needs to be expanded to also return location
exports.getMany = async (req, res) => {
    try {
      //this needs to be expanded to changed to send
      //  -latlon data for app to place markers
      //  -only listing IDs and title, leave individual (ie marker taps) to findByPk method
      var latlon = {lat: parseFloat(req.query.lat), lon: parseFloat(req.query.lon)};
      //code for calculating circle distances would go here, centre point coords stored in req.body.lat and req.body.lon
      //ideally results in assoc array with fields pos1, pos2 to dentote two lat/lon points (bottom left and top right) that form a square for us to check within
      var pos1 = {lat: latlon.lat - 0.1, lon: latlon.lon - 0.1};
      var pos2 = {lat: latlon.lat + 0.1, lon: latlon.lon + 0.1};
    
      //this retrieves an array of DAO's with the listings id fields
      var idResults = await addressDB.address.findAll({ where: {
        [Op.and] : [
          {lat: {
            [Op.between]: [pos1.lat, pos2.lat]
          }},
          {lon: {
            [Op.between]: [pos1.lon, pos2.lon]
          }}
        ]
      }, attributes: ['place_ID'] });

      //we then parse to a map-able array
      idResults = idResults.map(x => x.toJSON());
      //extract just an array of IDs
      console.log(idArray);
      var idArray = idResults.map(x => x.place_ID)
      //then find all listings with those IDs
      var listings = await listingDB.findAll({
        where: {
          addressPlaceID : {
            [Op.in]: [idArray]
          }
        }
      });
      //then parse the data to JSON
      listings = listings.map(x => x.toJSON());
      //and send it
      res.status(200).send(listings);    
    } catch (error) {
      //if we encounter a problem, return problem code
      console.log(error);
      res.status(500).send("Error retrieving listing data from server.");
    }
  };

  // Controller to retrieve a single listing
  exports.getOne = async (req, res) => {
    try {
      //needs to be expanded to
      //  -collect relational rows in other tables (at, address, tag, creates, user)
      //  -extract useful data (user contact info, latlon, address, tags)
      //  -format into a single object
      //  -return that object to the app
      //presently just returns the single row from the table
      var listingID = req.query.id;
      var listing = await listingDB.findByPk(listingID);
      if (listing != null){
        listing.toJSON();
        res.status(200).send(listing);
      }
      else{
        res.status(500).send("No listings found.");
      }
    } catch (error) {
      res.status(500).send("Error retrieving listing data from server.");
    }
  };

  exports.getSearchResults = async (req, res) => {
    try {
      //first we'll need to extract keywords
      var keywords = req.query.keywords;
      var tags = req.query.tags;
      
      //if no search terms
      if ((keywords == null) && (tags == null))
        res.status(500).send("Must be searching by at least one tag or keyword.")
      //if no keywords (ie only tags)
      else if(keywords == null){
        //going to assume we have seperated tags by '+''
        var tagsList = tags.split('+');
        //db query here
      }
      //only keywords
      else if (tags == null){
        //going to assume we have seperated keywords by '+'
        var keywordList = keywords.split('+');
        //db query here
        results = listingDB.findAll({where:
        {
          
        }});
        //select * from listing where
      }
      //else, both
      else {
        keywordList = keywords.split('+');
        tagsList = tags.split('+');
        //db query here
      }
    } catch (error) {
      
    }
  }

  //    Below is reference code from uni    //

  /*
  // Controller for creating a new listing in the database
exports.create = (req, res) => {
  if (!req.body) {
    res.status(400).send({
      message: "Content can not be empty!"
    });
  }

  //this object is what we pass to the create() model to make new rows in the database
  var listing = new Listing({
    id: req.body.id,
    title: req.body.title,
    desc: req.body.desc,
    lat: req.body.lat,
    lng: req.body.lng
  });

  
  Listing.create(listing, (err, data) => {
    if (err)
      res.status(400).send({
        message:
          err.message || "Invalid project data"
      });
    else res.status(200).send(data);
  });
};


// Controller for retrieving a single listing from the database using listing id
exports.getOne = (req, res) => {
  if (!req.body) {
    res.status(400).send({
      message: "Content can not be empty!"
    });
  }

  if(req.body.id){
    Listing.getID(req.body.id, (err, data) => {
      if (err)
        res.status(404).send({
          message:
            err.message || "Resource not found"
        });
      else res.status(200).send(data);
    });
  }
};

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
