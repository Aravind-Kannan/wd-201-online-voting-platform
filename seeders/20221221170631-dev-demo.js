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
          name: "FIFA WC 2022: Semi Final Trivia",
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
          title: "Who will the Semi-Final 1?",
          description: "ARG vs CRO: Will Argentina payback the debt of 2018?",
          createdAt: new Date(),
          updatedAt: new Date(),
          electionId: await queryInterface.rawSelect(
            "Elections",
            {
              where: {
                name: "FIFA WC 2022: Semi Final Trivia",
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
          title: "Argentina",
          createdAt: new Date(),
          updatedAt: new Date(),
          questionId: await queryInterface.rawSelect(
            "Questions",
            {
              where: {
                title: "Who will the Semi-Final 1?",
              },
            },
            ["id"]
          ),
        },
        {
          title: "Croatia",
          createdAt: new Date(),
          updatedAt: new Date(),
          questionId: await queryInterface.rawSelect(
            "Questions",
            {
              where: {
                title: "Who will the Semi-Final 1?",
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
          title: "Who will the Semi-Final 2?",
          description:
            "FRA vs MOR: The face-off of the underdogs, African Lions, against Le Bluers!",
          createdAt: new Date(),
          updatedAt: new Date(),
          electionId: await queryInterface.rawSelect(
            "Elections",
            {
              where: {
                name: "FIFA WC 2022: Semi Final Trivia",
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
          title: "France",
          createdAt: new Date(),
          updatedAt: new Date(),
          questionId: await queryInterface.rawSelect(
            "Questions",
            {
              where: {
                title: "Who will the Semi-Final 2?",
              },
            },
            ["id"]
          ),
        },
        {
          title: "Morocco",
          createdAt: new Date(),
          updatedAt: new Date(),
          questionId: await queryInterface.rawSelect(
            "Questions",
            {
              where: {
                title: "Who will the Semi-Final 2?",
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
          voterId: "JohnDoe",
          password: await bcrypt.hash("johnDoe", saltRounds),
          createdAt: new Date(),
          updatedAt: new Date(),
          electionId: await queryInterface.rawSelect(
            "Elections",
            {
              where: {
                name: "FIFA WC 2022: Semi Final Trivia",
              },
            },
            ["id"]
          ),
        },
        {
          voterId: "JaneDoe",
          password: await bcrypt.hash("janeDoe", saltRounds),
          createdAt: new Date(),
          updatedAt: new Date(),
          electionId: await queryInterface.rawSelect(
            "Elections",
            {
              where: {
                name: "FIFA WC 2022: Semi Final Trivia",
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
