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
          max: {
            args: [32],
            msg: "Maximum 32 characters allowed in password",
          },
          min: {
            args: [2],
            msg: "Minimum 2 characters required in password",
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
