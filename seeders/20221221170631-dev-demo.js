"use strict";

const bcrypt = require("bcrypt");
const saltRounds = 10;

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  // eslint-disable-next-line no-unused-vars
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert(
      "Users",
      [
        {
          firstName: "Test",
          lastName: "User A",
          email: "user.a@test.com",
          password: await bcrypt.hash("usera", saltRounds),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          firstName: "Test",
          lastName: "User B",
          email: "user.b@test.com",
          password: await bcrypt.hash("userb", saltRounds),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      {}
    );

    await queryInterface.bulkInsert(
      "Elections",
      [
        {
          name: "Election 1",
          start: false,
          end: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: await queryInterface.rawSelect(
            "Users",
            {
              where: {
                email: "user.a@test.com",
              },
            },
            ["id"]
          ),
        },
      ],
      {}
    );

    await queryInterface.bulkInsert(
      "Questions",
      [
        {
          title: "Question 1",
          description: "Description 1",
          createdAt: new Date(),
          updatedAt: new Date(),
          electionId: await queryInterface.rawSelect(
            "Elections",
            {
              where: {
                name: "Election 1",
              },
            },
            ["id"]
          ),
        },
      ],
      {}
    );

    await queryInterface.bulkInsert(
      "Options",
      [
        {
          title: "Option 1",
          createdAt: new Date(),
          updatedAt: new Date(),
          questionId: await queryInterface.rawSelect(
            "Questions",
            {
              where: {
                title: "Question 1",
              },
            },
            ["id"]
          ),
        },
        {
          title: "Option 2",
          createdAt: new Date(),
          updatedAt: new Date(),
          questionId: await queryInterface.rawSelect(
            "Questions",
            {
              where: {
                title: "Question 1",
              },
            },
            ["id"]
          ),
        },
      ],
      {}
    );

    await queryInterface.bulkInsert(
      "Voters",
      [
        {
          voterId: "Voter1",
          password: "voter1",
          createdAt: new Date(),
          updatedAt: new Date(),
          electionId: await queryInterface.rawSelect(
            "Elections",
            {
              where: {
                name: "Election 1",
              },
            },
            ["id"]
          ),
        },
        {
          voterId: "Voter2",
          password: "voter2",
          createdAt: new Date(),
          updatedAt: new Date(),
          electionId: await queryInterface.rawSelect(
            "Elections",
            {
              where: {
                name: "Election 1",
              },
            },
            ["id"]
          ),
        },
      ],
      {}
    );
  },

  // eslint-disable-next-line no-unused-vars
  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("Voters", null, {});
    await queryInterface.bulkDelete("Options", null, {});
    await queryInterface.bulkDelete("Questions", null, {});
    await queryInterface.bulkDelete("Elections", null, {});
    await queryInterface.bulkDelete("Users", null, {});
  },
};
