/* eslint-disable no-undef */
const app = require("./app");

// NOTE Start a simple web server
app.listen(process.env.PORT || 3000, () => {
  console.log(
    `Server started at: http://127.0.0.1:${process.env.PORT || 3000}`
  );
});
