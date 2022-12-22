"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Options extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Options.belongsTo(models.Questions, {
        foreignKey: "questionId",
      });
      Options.hasMany(models.Votes, {
        foreignKey: "optionId",
      });
    }
    static createOption(title, questionId) {
      return this.create({
        title,
        questionId,
      });
    }
    updateTitle(title) {
      return this.update({ title });
    }
    static async remove(id, questionId) {
      return this.destroy({
        where: {
          id,
          questionId,
        },
      });
    }
  }
  Options.init(
    {
      title: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "Options",
    }
  );
  return Options;
};
