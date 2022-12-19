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
