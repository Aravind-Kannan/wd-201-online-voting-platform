const express = require("express");
const app = express();

// NOTE middleware that only parses json and only looks at requests where the Content-Type header matches the type option.
const bodyParser = require("body-parser");
app.use(bodyParser.json());

// NOTE Set EJS as view engine
app.set("view engine", "ejs");

app.get("/", (request, response) => {
  response.send("Hello world!");
});

module.exports = app;
