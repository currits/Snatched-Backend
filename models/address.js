const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('address', {
    place_ID: {
      type: DataTypes.STRING(256),
      allowNull: false,
      primaryKey: true
    },
    lat: {
      type: DataTypes.DECIMAL(8,6),
      allowNull: false
    },
    lon: {
      type: DataTypes.DECIMAL(9,6),
      allowNull: false
    },
    street_no: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    street_name: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    town_city: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    country: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    unit_no: {
      type: DataTypes.STRING(10),
      allowNull: true
    },
    postcode: {
      type: DataTypes.STRING(10),
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'address',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "place_ID" },
        ]
      },
    ]
  });
};
