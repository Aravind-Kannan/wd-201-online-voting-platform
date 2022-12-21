"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Voters extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Voters.belongsTo(models.Elections, {
        foreignKey: "electionId",
      });
    }
    static createVoter(voterId, password, electionId) {
      return this.create({
        voterId,
        password,
        electionId,
      });
    }
    static async remove(id, electionId) {
      return this.destroy({
        where: {
          id,
          electionId,
        },
      });
    }
  }
  Voters.init(
    {
      voterId: DataTypes.STRING,
      password: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "Voters",
    }
  );
  return Voters;
};
