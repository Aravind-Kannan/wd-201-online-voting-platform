// NOTE Server - client architecture testing setup
const request = require("supertest");
// NOTE Used to parse markup language
// const cheerio = require("cheerio");

const db = require("../models/index");
const app = require("../app");

let server, agent;
// function extractCsrfToken(res) {
//   let $ = cheerio.load(res.text);
//   return $("[name=_csrf]").val();
// }

describe("User Test Suite", () => {
  beforeAll(async () => {
    await db.sequelize.sync({ forced: true });
    server = app.listen(3000, () => {});
    // NOTE client agent for server
    agent = request.agent(server);
    await agent.get("/");
  });
  afterAll(async () => {
    await db.sequelize.close();
    server.close();
  });

  test("Testing hello world", async () => {});
});
