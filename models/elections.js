"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Elections extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Elections.belongsTo(models.Users, {
        foreignKey: "userId",
      });
      Elections.hasMany(models.Questions, {
        foreignKey: "electionId",
      });
      Elections.hasMany(models.Voters, {
        foreignKey: "electionId",
      });
    }
    static created(userId) {
      return this.findAll({
        userId,
      });
    }
  }
  Elections.init(
    {
      name: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "Elections",
    }
  );
  return Elections;
};
