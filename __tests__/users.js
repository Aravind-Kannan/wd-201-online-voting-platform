// NOTE Server - client architecture testing setup
const request = require("supertest");

const db = require("../models/index");
const app = require("../app");

let server, agent;

describe("User Test Suite", () => {
  beforeAll(async () => {
    await db.sequelize.sync({ forced: true });
    server = app.listen(3000, () => {});
    // NOTE client agent for server
    agent = request.agent(server);
  });
  afterAll(async () => {
    await db.sequelize.close();
    server.close();
  });

  test("Testing hello world", async () => {
    const response = await agent.get("/");
    expect(response.text).toBe("Hello world!");
  });
});
