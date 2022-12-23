// NOTE Server - client architecture testing setup
const request = require("supertest");
// NOTE Used to parse markup language
const cheerio = require("cheerio");

const db = require("../models/index");
const app = require("../app");

let server, agent;

function extractCsrfToken(res) {
  let $ = cheerio.load(res.text);
  return $("[name=_csrf]").val();
}

async function loginAsAdmin(agent, username, password) {
  let res = await agent.get("/login");
  let csrfToken = extractCsrfToken(res);
  res = await agent.post("/session").send({
    email: username,
    password,
    _csrf: csrfToken,
  });
}

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

  test("User A: Sign up", async () => {
    let res = await agent.get("/signup");
    const csrfToken = extractCsrfToken(res);
    res = await agent.post("/users").send({
      firstName: "Test",
      lastName: "User A",
      email: "user.a@test.com",
      password: "12345678",
      _csrf: csrfToken,
    });
    expect(res.statusCode).toBe(302);
  });

  test("User A: Sign out", async () => {
    let res = await agent.get("/dashboard");
    expect(res.statusCode).toBe(200);
    res = await agent.get("/signout");
    expect(res.statusCode).toBe(302);
    res = await agent.get("/dashboard");
    expect(res.statusCode).toBe(302);
  });

  test("User A: Creates a election and redirects back to dashboard", async () => {
    // NOTE Login as Admin
    const agent = request.agent(server);
    await loginAsAdmin(agent, "user.a@test.com", "12345678");

    // NOTE Fetch all elections to obtain count
    let electionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    let elections = JSON.parse(electionsResponse.text);
    const count = elections.length;

    // NOTE Create new election
    const res = await agent.get("/dashboard");
    const csrfToken = extractCsrfToken(res);
    await agent.post("/elections").send({
      name: "WC 2022: Trivia",
      _csrf: csrfToken,
    });

    // NOTE Fetch all elections to obtain latestCount
    electionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    elections = JSON.parse(electionsResponse.text);
    const latestCount = elections.length;

    // NOTE Compare counts
    expect(latestCount).toBe(count + 1);
  });

  test("User A: Edit election name and redirects back to dashboard", async () => {
    // NOTE Login as Admin
    const agent = request.agent(server);
    await loginAsAdmin(agent, "user.a@test.com", "12345678");

    // NOTE Create new election
    let res = await agent.get("/dashboard");
    let csrfToken = extractCsrfToken(res);
    await agent.post("/elections").send({
      name: "Election",
      _csrf: csrfToken,
    });

    // NOTE Fetch all elections to obtain latest electionId
    let electionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    let elections = JSON.parse(electionsResponse.text);
    const count = elections.length;

    // NOTE Update the created election
    res = await agent.get("/dashboard");
    csrfToken = extractCsrfToken(res);
    await agent.put(`/elections/${elections[count - 1].id}`).send({
      name: "Election update",
      _csrf: csrfToken,
    });

    // NOTE Fetch all elections to check if changed
    electionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    elections = JSON.parse(electionsResponse.text);

    // NOTE Compare the newly updated name
    expect(elections[count - 1].name).toBe("Election update");
  });

  test("User A: Delete a election and redirects back to dashboard", async () => {
    // NOTE Login as Admin
    const agent = request.agent(server);
    await loginAsAdmin(agent, "user.a@test.com", "12345678");

    // NOTE Create new election
    let res = await agent.get("/dashboard");
    let csrfToken = extractCsrfToken(res);
    await agent.post("/elections").send({
      name: "Delete me!",
      _csrf: csrfToken,
    });

    // NOTE Fetch all elections to obtain latest electionId
    let electionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    let elections = JSON.parse(electionsResponse.text);
    const count = elections.length;

    // NOTE Update the created election
    res = await agent.get("/dashboard");
    csrfToken = extractCsrfToken(res);
    await agent.delete(`/elections/${elections[count - 1].id}`).send({
      _csrf: csrfToken,
    });

    // NOTE Fetch all elections to check if changed
    electionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    elections = JSON.parse(electionsResponse.text);
    const latestCount = elections.length;

    // NOTE Compare the newly updated name
    expect(latestCount).toBe(count - 1);
  });
});
