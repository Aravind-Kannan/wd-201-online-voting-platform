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
    static createElection(name, userId) {
      return this.create({
        name,
        start: false,
        end: false,
        userId,
      });
    }
    static created(userId) {
      return this.findAll({
        where: {
          userId,
        },
      });
    }
    updateName(name) {
      return this.update({ name });
    }
    updateStart(start) {
      return this.update({ start });
    }
    updateEnd(end) {
      return this.update({ end });
    }
    static async remove(id, userId) {
      return this.destroy({
        where: {
          id,
          userId,
        },
      });
    }
  }
  Elections.init(
    {
      name: DataTypes.STRING,
      start: DataTypes.BOOLEAN,
      end: DataTypes.BOOLEAN,
    },
    {
      sequelize,
      modelName: "Elections",
    }
  );
  return Elections;
};
