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
      Elections.hasMany(models.Votes, {
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
    async hasInsufficientQuestions(eid) {
      const election = await Elections.findByPk(eid, {
        include: [
          {
            model: sequelize.models.Questions,
            include: sequelize.models.Options,
          },
          { model: sequelize.models.Voters, include: sequelize.models.Votes },
        ],
      });

      return election.Questions.length === 0;
    }
    async hasInsufficientOptions(eid) {
      const election = await Elections.findByPk(eid, {
        include: [
          {
            model: sequelize.models.Questions,
            include: sequelize.models.Options,
          },
          { model: sequelize.models.Voters, include: sequelize.models.Votes },
        ],
      });

      const count = election.Questions.filter(
        (question) => question.Options.length < 2
      );

      return count.length !== 0;
    }
    async hasInsufficientVoters(eid) {
      const election = await Elections.findByPk(eid, {
        include: [
          {
            model: sequelize.models.Questions,
            include: sequelize.models.Options,
          },
          { model: sequelize.models.Voters, include: sequelize.models.Votes },
        ],
      });

      return election.Voters.length < 2;
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
