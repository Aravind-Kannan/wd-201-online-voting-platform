"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Questions extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Questions.belongsTo(models.Elections, {
        foreignKey: "electionId",
      });
      Questions.hasMany(models.Options, {
        foreignKey: "questionId",
      });
    }
    static createQuestion(title, description, electionId) {
      return this.create({
        title,
        description,
        electionId,
      });
    }
    updateTitle(title) {
      return this.update({ title });
    }
    updateDescription(description) {
      return this.update({ description });
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
  Questions.init(
    {
      title: DataTypes.STRING,
      description: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "Questions",
    }
  );
  return Questions;
};
