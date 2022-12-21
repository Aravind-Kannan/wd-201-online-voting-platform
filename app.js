const express = require("express");
const app = express();

// NOTE import data models
const { Users, Elections, Questions, Options } = require("./models");

// NOTE middleware that only parses json and only looks at requests where the Content-Type header matches the type option
const bodyParser = require("body-parser");
app.use(bodyParser.json());

// NOTE middleware that only parses urlencoded bodies and only looks at requests where the Content-Type header matches the type option
app.use(express.urlencoded({ extended: true }));

// NOTE middleware that serves static files and is based on serve-static
const path = require("path");
// eslint-disable-next-line no-undef
app.use(express.static(path.join(__dirname, "public")));

// NOTE middleware to parse CSRF token
const cookieParser = require("cookie-parser");
const csurf = require("tiny-csrf");
app.use(cookieParser("shh! some secret string"));
app.use(csurf("this_should_be_32_character_long", ["POST", "PUT", "DELETE"]));

// NOTE middleware for authentication
const passport = require("passport");
const connectEnsureLogin = require("connect-ensure-login");
const session = require("express-session");
const LocalStrategy = require("passport-local");

// NOTE for session handling
app.use(
  session({
    secret: "super-secret-key",
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// NOTE for initializing Passport.js
app.use(passport.initialize());
app.use(passport.session());

// NOTE for authenticating user credentials
passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    (username, password, done) => {
      Users.findOne({
        where: {
          email: username,
        },
      })
        .then(async (user) => {
          const result = await bcrypt.compare(password, user.password);
          if (result) return done(null, user);
          else return done(null, false, { message: "Invalid password" });
        })
        .catch((err) => {
          return done(err);
        });
    }
  )
);

// NOTE store detail in session by serializing
passport.serializeUser((user, done) => {
  console.log("Serializing user in session", user.id);
  done(null, user.id);
});

// NOTE read detail in session by deserializing
passport.deserializeUser((id, done) => {
  Users.findByPk(id)
    .then((user) => done(null, user))
    .catch((error) => done(error, null));
});

// NOTE library to convert passwords to hashes
const bcrypt = require("bcrypt");
const saltRounds = 10;

// NOTE library for flash messages
const flash = require("connect-flash");
app.use(flash());

app.use(function (request, response, next) {
  response.locals.messages = request.flash();
  next();
});

// NOTE link to views directory
// eslint-disable-next-line no-undef
app.set("views", path.join(__dirname, "views"));

// NOTE Set EJS as view engine
app.set("view engine", "ejs");

app.get("/", (request, response) => {
  response.render("index");
});

app.get("/signup", (request, response) => {
  response.render("signup", { csrfToken: request.csrfToken() });
});

app.get("/login", (request, response) => {
  response.render("login", { csrfToken: request.csrfToken() });
});

app.get(
  "/dashboard",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const loggedInUser = request.user.id;
    const elections = await Elections.created(loggedInUser);
    response.render("dashboard", {
      user: request.user,
      elections,
      csrfToken: request.csrfToken(),
    });
  }
);

app.post(
  "/session",
  passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  (request, response) => {
    console.log(request.user);
    response.redirect("/dashboard");
  }
);

app.post("/users", async (request, response) => {
  const hashedPwd = await bcrypt.hash(request.body.password, saltRounds);
  try {
    const user = await Users.create({
      firstName: request.body.firstName,
      lastName: request.body.lastName,
      email: request.body.email,
      password: hashedPwd,
    });
    request.login(user, (err) => {
      if (err) {
        console.log(err);
      }
      response.redirect("/dashboard");
    });
  } catch (error) {
    request.flash("error", error.errors[0].message);
    console.log(error);
    response.redirect("/signup");
  }
});

app.get("/signout", (request, response, next) => {
  request.logout((err) => {
    if (err) {
      return next(err);
    }
    response.redirect("/");
  });
});

// NOTE Elections Resource
app.get(
  "/elections/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    try {
      const election = await Elections.findByPk(request.params.id);
      return response.json(election);
    } catch (error) {
      console.log(error);
      return response.status(422).json(error);
    }
  }
);

app.post(
  "/elections",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    try {
      const loggedInUser = request.user.id;
      await Elections.createElection(request.body.name, loggedInUser);
      return response.redirect("/dashboard");
    } catch (error) {
      console.log(error);
      return response.redirect("/dashboard");
    }
  }
);

app.put(
  "/elections/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const election = await Elections.findByPk(request.params.id);
    console.log(request.body);
    try {
      if ("name" in request.body) {
        let updatedElection = await election.updateName(request.body.name);
        return response.json(updatedElection);
      }
      return response.status(422).json({ message: "Missing name property" });
    } catch (error) {
      console.log(error);
      return response.status(422).json(error);
    }
  }
);

app.delete(
  "/elections/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    try {
      await Elections.remove(request.params.id, request.user.id);
      return response.json({ success: true });
    } catch (error) {
      console.log(error);
      return response.status(422).json(error);
    }
  }
);

app.get(
  "/elections/:id/ballot",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    try {
      const election = await Elections.findByPk(request.params.id, {
        include: { model: Questions, include: Options },
      });
      console.log(JSON.stringify(election, null, 2));
      return response.render("ballot", {
        csrfToken: request.csrfToken(),
        user: request.user,
        election,
      });
    } catch (error) {
      console.log(error);
      return response.status(422).json(error);
    }
  }
);

// NOTE Questions Resource
app.get(
  "/elections/:eid/questions/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    try {
      const question = await Questions.findByPk(request.params.id);
      return response.json(question);
    } catch (error) {
      console.log(error);
      return response.status(422).json(error);
    }
  }
);

app.post(
  "/elections/:eid/questions",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    try {
      await Questions.createQuestion(
        request.body.title,
        request.body.description,
        request.params.eid
      );
      return response.redirect(`/elections/${request.params.eid}/ballot`);
    } catch (error) {
      console.log(error);
      return response.redirect(`/elections/${request.params.eid}/ballot`);
    }
  }
);

app.put(
  "/elections/:eid/questions/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const question = await Questions.findByPk(request.params.id);
    console.log(request.body);
    let updated = false,
      updatedQuestion;
    try {
      if ("title" in request.body) {
        updatedQuestion = await question.updateTitle(request.body.title);
        updated = true;
      }

      if ("description" in request.body) {
        updatedQuestion = await question.updateDescription(
          request.body.description
        );
        updated = true;
      }

      if (updated) {
        return response.json(updatedQuestion);
      }

      return response
        .status(422)
        .json({ message: "Missing title and description property" });
    } catch (error) {
      console.log(error);
      return response.status(422).json(error);
    }
  }
);

app.delete(
  "/elections/:eid/questions/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    try {
      await Questions.remove(request.params.id, request.params.eid);
      return response.json({ success: true });
    } catch (error) {
      console.log(error);
      return response.status(422).json(error);
    }
  }
);

// NOTE Options Resource
app.get(
  "/elections/:eid/questions/:qid/options/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    try {
      const option = await Options.findByPk(request.params.id);
      return response.json(option);
    } catch (error) {
      console.log(error);
      return response.status(422).json(error);
    }
  }
);

app.post(
  "/elections/:eid/questions/:qid/options",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    try {
      await Options.createOption(request.body.title, request.params.qid);
      return response.redirect(`/elections/${request.params.eid}/ballot`);
    } catch (error) {
      console.log(error);
      return response.redirect(`/elections/${request.params.eid}/ballot`);
    }
  }
);

app.put(
  "/elections/:eid/questions/:qid/options/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const option = await Options.findByPk(request.params.id);
    console.log(request.body);
    let updated = false,
      updatedOption;
    try {
      if ("title" in request.body) {
        updatedOption = await option.updateTitle(request.body.title);
        updated = true;
      }

      if (updated) {
        return response.json(updatedOption);
      }

      return response.status(422).json({ message: "Missing title property" });
    } catch (error) {
      console.log(error);
      return response.status(422).json(error);
    }
  }
);

app.delete(
  "/elections/:eid/questions/:qid/options/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    try {
      await Options.remove(request.params.id, request.params.qid);
      return response.json({ success: true });
    } catch (error) {
      console.log(error);
      return response.status(422).json(error);
    }
  }
);

module.exports = app;
