"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Votes extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Votes.belongsTo(models.Elections, {
        foreignKey: "electionId",
      });
      Votes.belongsTo(models.Questions, {
        foreignKey: "questionId",
      });
      Votes.belongsTo(models.Options, {
        foreignKey: "optionId",
      });
      Votes.belongsTo(models.Voters, {
        foreignKey: "voterId",
      });
    }

    static createVote(electionId, questionId, optionId, voterId) {
      return this.create({
        electionId,
        questionId,
        optionId,
        voterId,
      });
    }

    static async haveAlreadyVoted(electionId, voterId) {
      return await this.findAll({
        attributes: [
          "electionId",
          "voterId",
          sequelize.fn("count", sequelize.col("id")),
        ],
        group: ["Votes.electionId", "Votes.voterId"],
        where: { electionId, voterId },
      }).then(function (result) {
        return result.length !== 0;
      });
    }
  }
  Votes.init(
    {
      electionId: DataTypes.INTEGER,
      questionId: DataTypes.INTEGER,
      optionId: DataTypes.INTEGER,
      voterId: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: "Votes",
    }
  );
  return Votes;
};
