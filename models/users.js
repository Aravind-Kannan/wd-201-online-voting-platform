"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Users extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Users.hasMany(models.Elections, {
        foreignKey: "userId",
      });
    }
  }
  Users.init(
    {
      firstName: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notNull: { msg: '"First Name" is required' },
          notEmpty: { msg: '"First Name" is required' },
          isAlpha: {
            msg: '"First Name" should comprise of Alphabets',
          },
        },
      },
      lastName: DataTypes.STRING,
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notNull: { msg: '"Email" is required' },
          notEmpty: { msg: '"Email" is required' },
          isEmail: {
            msg: '"Email" should be of the form: a@b.c',
          },
        },
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notNull: { msg: '"Password" is required' },
          notEmpty: { msg: '"Password" is required' },
          len: {
            args: [2, 32],
            msg: '"Password" length not sufficient (2-32 chars)',
          },
        },
      },
    },
    {
      sequelize,
      modelName: "Users",
    }
  );
  return Users;
};
