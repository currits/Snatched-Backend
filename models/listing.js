const Sequelize = require('sequelize');
module.exports = function (sequelize, DataTypes) {
  return sequelize.define('listing', {
    listing_ID: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    stock_num: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    pickup_instructions: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    title: {
      type: DataTypes.STRING(30),
      allowNull: true
    },
    description: {
      type: DataTypes.STRING(200),
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'listing',
    timestamps: true,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "listing_ID" },
        ]
      },
    ]
  });
};
