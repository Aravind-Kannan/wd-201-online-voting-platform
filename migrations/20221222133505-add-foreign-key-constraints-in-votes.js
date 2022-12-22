"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addConstraint("Votes", {
      fields: ["electionId"],
      type: "foreign key",
      references: {
        table: "Elections",
        field: "id",
      },
    });
    await queryInterface.addConstraint("Votes", {
      fields: ["questionId"],
      type: "foreign key",
      references: {
        table: "Questions",
        field: "id",
      },
    });
    await queryInterface.addConstraint("Votes", {
      fields: ["optionId"],
      type: "foreign key",
      references: {
        table: "Options",
        field: "id",
      },
    });
    await queryInterface.addConstraint("Votes", {
      fields: ["voterId"],
      type: "foreign key",
      references: {
        table: "Voters",
        field: "id",
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint(
      "Votes",
      "Votes_electionId_Elections_fk"
    );
    await queryInterface.removeConstraint(
      "Votes",
      "Votes_questionId_Questions_fk"
    );
    await queryInterface.removeConstraint("Votes", "Votes_optionId_Options_fk");
    await queryInterface.removeConstraint("Votes", "Votes_voterId_Voters_fk");
  },
};
