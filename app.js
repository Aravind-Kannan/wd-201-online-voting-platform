const express = require("express");
const app = express();

// NOTE import data models
const {
  Users,
  Elections,
  Questions,
  Options,
  Voters,
  Votes,
} = require("./models");

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
  "administrator",
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
          if (user !== null) {
            const result = await bcrypt.compare(password, user.password);
            if (result) return done(null, user);
            else return done(null, false, { message: "Incorrect Password" });
          } else {
            return done(null, false, { message: "Incorrect Email" });
          }
        })
        .catch((err) => {
          return done(err);
        });
    }
  )
);

passport.use(
  "voter",
  new LocalStrategy(
    {
      usernameField: "voterId",
      passwordField: "password",
      passReqToCallback: true,
    },
    (request, username, password, done) => {
      Voters.findOne({
        where: {
          voterId: username,
          electionId: request.params.eid,
        },
      })
        .then(async (voter) => {
          if (voter !== null) {
            const result = await bcrypt.compare(password, voter.password);
            if (result) return done(null, voter);
            else return done(null, false, { message: "Incorrect Password" });
          } else {
            return done(null, false, { message: "Incorrect Voter Id" });
          }
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
  let role,
    userPrototype = Object.getPrototypeOf(user);

  if (userPrototype === Voters.prototype) {
    role = "Voters";
  } else if (userPrototype === Users.prototype) {
    role = "Users";
  }

  done(null, { id: user.id, role });
});

// NOTE read detail in session by deserializing
passport.deserializeUser(({ id, role }, done) => {
  if (role === "Users") {
    Users.findByPk(id)
      .then((user) => done(null, user))
      .catch((error) => done(error, null));
  } else if (role === "Voters") {
    Voters.findByPk(id)
      .then((user) => done(null, user))
      .catch((error) => done(error, null));
  }
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

// NOTE Landing page for administrators
app.get("/", (request, response) => {
  response.render("index");
});

// NOTE Signup page for administrators
app.get("/signup", (request, response) => {
  response.render("signup", { csrfToken: request.csrfToken() });
});

// NOTE Login page for administrators
app.get("/login", (request, response) => {
  response.render("login", { csrfToken: request.csrfToken() });
});

// NOTE Dashboard page for administrators with corresponding authorised elections
app.get(
  "/dashboard",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (Object.getPrototypeOf(request.user) === Users.prototype) {
      const loggedInUser = request.user.id;
      const elections = await Elections.created(loggedInUser);
      response.render("dashboard", {
        user: request.user,
        elections,
        csrfToken: request.csrfToken(),
      });
    } else {
      response.status(403).render("error", {
        code: "403",
        status: "Forbidden",
        message:
          "Only authenticated administrators are authorized to view dashboard",
      });
    }
  }
);

// NOTE Session endpoint to login as administrator
app.post(
  "/session",
  passport.authenticate("administrator", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  (request, response) => {
    console.log(request.user);
    response.redirect("/dashboard");
  }
);

// NOTE Session endpoint to login as voter
app.post(
  "/session/:eid/voter",
  function (request, response, next) {
    const callback = passport.authenticate("voter", {
      failureRedirect: `/public/${request.params.eid}`,
      failureFlash: true,
    });
    return callback(request, response, next);
  },
  (request, response) => {
    console.log(request.user);
    response.redirect(`/public/${request.params.eid}/vote`);
  }
);

// NOTE [Users] Users endpoint to signup new administrators
app.post("/users", async (request, response) => {
  let hashedPwd = await bcrypt.hash(request.body.password, saltRounds);
  if (request.body.password === "") hashedPwd = "";
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
    console.log(error);
    if ("errors" in error)
      request.flash(
        "error",
        error.errors.map((error) => error.message)
      );
    response.redirect("/signup");
  }
});

// NOTE Signout endpoint to end authenticated session
app.get("/signout", (request, response, next) => {
  request.logout((err) => {
    if (err) {
      return next(err);
    }
    response.redirect("/");
  });
});

// NOTE [Elections] Elections endpoint to fetch all elections for given user
app.get(
  "/elections",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (Object.getPrototypeOf(request.user) === Users.prototype) {
      try {
        const election = await Elections.findAll({
          where: {
            userId: request.user.id,
          },
        });
        return response.json(election);
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else {
      return response.status(403).json({
        status: "Forbidden",
        message:
          "Only authenticated administrators are authorized to access elections resource",
      });
    }
  }
);

// NOTE [Elections] Elections endpoint to fetch a particular election
app.get(
  "/elections/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (Object.getPrototypeOf(request.user) === Users.prototype) {
      try {
        const election = await Elections.findByPk(request.params.id);
        return response.json(election);
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else {
      return response.status(403).json({
        status: "Forbidden",
        message:
          "Only authenticated administrators are authorized to access elections resource",
      });
    }
  }
);

// NOTE [Elections] Elections endpoint to add a new election
app.post(
  "/elections",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (Object.getPrototypeOf(request.user) === Users.prototype) {
      try {
        const loggedInUser = request.user.id;
        await Elections.createElection(request.body.name, loggedInUser);
        request.flash("success", "Added new election successfully");
        return response.redirect("/dashboard");
      } catch (error) {
        console.log(error);
        if ("errors" in error)
          request.flash(
            "error",
            error.errors.map((error) => error.message)
          );
        return response.redirect("/dashboard");
      }
    } else {
      response.status(403).render("error", {
        code: "403",
        status: "Forbidden",
        message:
          "Only authenticated administrators are authorized to create elections resource",
      });
    }
  }
);

// NOTE [Elections] Elections endpoint to update a existing election
app.put(
  "/elections/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    // console.log(request.body);
    if (Object.getPrototypeOf(request.user) === Users.prototype) {
      const election = await Elections.findByPk(request.params.id);
      let updatedElection,
        updated = false,
        invalid = false;
      try {
        console.log(request.body);
        if ("name" in request.body && request.body.name !== election.name) {
          updatedElection = await election.updateName(request.body.name);
          updated = true;
          request.flash("success", "Edited election name successfully");
        }

        if (
          "start" in request.body &&
          election.start === false &&
          request.body.start === true
        ) {
          if (await election.hasInsufficientQuestions(request.params.id)) {
            request.flash(
              "error",
              "Please create a minimum of 1 question to start election"
            );
            invalid = true;
          }

          if (await election.hasInsufficientOptions(request.params.id)) {
            request.flash(
              "error",
              "Please create a minimum of 2 options per question to start election"
            );
            invalid = true;
          }

          if (await election.hasInsufficientVoters(request.params.id)) {
            request.flash(
              "error",
              "Please create a minimum of 2 voters to start election"
            );
            invalid = true;
          }

          if (!invalid) {
            updatedElection = await election.updateStart(request.body.start);
            updated = true;
            request.flash("success", "Started election successfully");
          }
          updated = true;
        }

        if (
          "end" in request.body &&
          election.end === false &&
          request.body.end === true
        ) {
          updatedElection = await election.updateEnd(request.body.end);
          updated = true;
          request.flash("success", "Ended election successfully");
        }

        if (!updated)
          return response
            .status(422)
            .json({ message: "Missing name, start and/or end property" });

        return response.json(updatedElection);
      } catch (error) {
        console.log(error);
        if ("errors" in error) {
          request.flash(
            "error",
            error.errors.map((error) => error.message)
          );
        }
        return response.status(422).json(error);
      }
    } else {
      return response.status(403).json({
        status: "Forbidden",
        message:
          "Only authenticated administrators are authorized to update elections resource",
      });
    }
  }
);

// NOTE [Elections] Elections endpoint to delete a existing election
app.delete(
  "/elections/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (Object.getPrototypeOf(request.user) === Users.prototype) {
      try {
        await Elections.remove(request.params.id, request.user.id);
        return response.json({ success: true });
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else {
      return response.status(403).json({
        status: "Forbidden",
        message:
          "Only authenticated administrators are authorized to delete elections resource",
      });
    }
  }
);

// NOTE Election ballot page comprising of the questions, options and voters list
app.get(
  "/elections/:id/ballot",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (Object.getPrototypeOf(request.user) === Users.prototype) {
      try {
        const election = await Elections.findByPk(request.params.id, {
          include: [
            { model: Questions, include: Options },
            { model: Voters, include: Votes },
          ],
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
    } else {
      response.status(403).render("error", {
        code: "403",
        status: "Forbidden",
        message:
          "Only authenticated administrators are authorized to create elections resource",
      });
    }
  }
);

// NOTE [Questions] Questions endpoint to fetch all elections for given user
app.get(
  "/elections/:eid/questions",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (Object.getPrototypeOf(request.user) === Users.prototype) {
      try {
        const questions = await Questions.findAll({
          where: {
            electionId: request.params.eid,
          },
        });
        return response.json(questions);
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else {
      return response.status(403).json({
        status: "Forbidden",
        message:
          "Only authenticated administrators are authorized to access questions resource",
      });
    }
  }
);

// NOTE [Questions] Questions endpoint to fetch a particular question
app.get(
  "/elections/:eid/questions/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (Object.getPrototypeOf(request.user) === Users.prototype) {
      try {
        const question = await Questions.findByPk(request.params.id);
        return response.json(question);
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else {
      return response.status(403).json({
        status: "Forbidden",
        message:
          "Only authenticated administrators are authorized to access questions resource",
      });
    }
  }
);

// NOTE [Questions] Questions endpoint to add a new question
app.post(
  "/elections/:eid/questions",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (Object.getPrototypeOf(request.user) === Users.prototype) {
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
    } else {
      return response.status(403).json({
        status: "Forbidden",
        message:
          "Only authenticated administrators are authorized to create questions resource",
      });
    }
  }
);

// NOTE [Questions] Questions endpoint to update a existing question
app.put(
  "/elections/:eid/questions/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (Object.getPrototypeOf(request.user) === Users.prototype) {
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
    } else {
      return response.status(403).json({
        status: "Forbidden",
        message:
          "Only authenticated administrators are authorized to update questions resource",
      });
    }
  }
);

// NOTE [Questions] Questions endpoint to delete a existing question
app.delete(
  "/elections/:eid/questions/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (Object.getPrototypeOf(request.user) === Users.prototype) {
      try {
        await Questions.remove(request.params.id, request.params.eid);
        return response.json({ success: true });
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else {
      return response.status(403).json({
        status: "Forbidden",
        message:
          "Only authenticated administrators are authorized to delete questions resource",
      });
    }
  }
);

// NOTE [Options] Options endpoint to fetch all options for given election and question
app.get(
  "/elections/:eid/questions/:qid/options",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (Object.getPrototypeOf(request.user) === Users.prototype) {
      try {
        const options = await Options.findAll({
          where: {
            questionId: request.params.qid,
          },
        });
        return response.json(options);
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else {
      return response.status(403).json({
        status: "Forbidden",
        message:
          "Only authenticated administrators are authorized to access options resource",
      });
    }
  }
);

// NOTE [Options] Options endpoint to fetch a particular option
app.get(
  "/elections/:eid/questions/:qid/options/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (Object.getPrototypeOf(request.user) === Users.prototype) {
      try {
        const option = await Options.findByPk(request.params.id);
        return response.json(option);
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else {
      return response.status(403).json({
        status: "Forbidden",
        message:
          "Only authenticated administrators are authorized to access options resource",
      });
    }
  }
);

// NOTE [Options] Options endpoint to add a new option
app.post(
  "/elections/:eid/questions/:qid/options",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (Object.getPrototypeOf(request.user) === Users.prototype) {
      try {
        await Options.createOption(request.body.title, request.params.qid);
        return response.redirect(`/elections/${request.params.eid}/ballot`);
      } catch (error) {
        console.log(error);
        return response.redirect(`/elections/${request.params.eid}/ballot`);
      }
    } else {
      return response.status(403).json({
        status: "Forbidden",
        message:
          "Only authenticated administrators are authorized to create options resource",
      });
    }
  }
);

// NOTE [Options] Options endpoint to update a existing option
app.put(
  "/elections/:eid/questions/:qid/options/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (Object.getPrototypeOf(request.user) === Users.prototype) {
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
    } else {
      return response.status(403).json({
        status: "Forbidden",
        message:
          "Only authenticated administrators are authorized to update options resource",
      });
    }
  }
);

// NOTE [Options] Options endpoint to delete a existing option
app.delete(
  "/elections/:eid/questions/:qid/options/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (Object.getPrototypeOf(request.user) === Users.prototype) {
      try {
        await Options.remove(request.params.id, request.params.qid);
        return response.json({ success: true });
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else {
      return response.status(403).json({
        status: "Forbidden",
        message:
          "Only authenticated administrators are authorized to delete options resource",
      });
    }
  }
);

// NOTE [Voters] Voters endpoint to fetch all voters for given election
app.get(
  "/elections/:eid/voters",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (Object.getPrototypeOf(request.user) === Users.prototype) {
      try {
        const voters = await Voters.findAll({
          where: {
            electionId: request.params.eid,
          },
        });
        return response.json(voters);
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else {
      return response.status(403).json({
        status: "Forbidden",
        message:
          "Only authenticated administrators are authorized to access voters resource",
      });
    }
  }
);

// NOTE [Voters] Voters endpoint to fetch a particular voter
app.get(
  "/elections/:eid/voters/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (Object.getPrototypeOf(request.user) === Users.prototype) {
      try {
        const voter = await Voters.findByPk(request.params.id);
        return response.json(voter);
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else {
      return response.status(403).json({
        status: "Forbidden",
        message:
          "Only authenticated administrators are authorized to fetch voters resource",
      });
    }
  }
);

// NOTE [Voters] Voters endpoint to add a new voter
app.post(
  "/elections/:eid/voters",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (Object.getPrototypeOf(request.user) === Users.prototype) {
      try {
        await Voters.createVoter(
          request.body.voterId,
          await bcrypt.hash(request.body.password, saltRounds),
          request.params.eid
        );
        return response.redirect(`/elections/${request.params.eid}/ballot`);
      } catch (error) {
        console.log(error);
        return response.redirect(`/elections/${request.params.eid}/ballot`);
      }
    } else {
      return response.status(403).json({
        status: "Forbidden",
        message:
          "Only authenticated administrators are authorized to create voters resource",
      });
    }
  }
);

// NOTE [Voters] Voters endpoint to delete a existing voter
app.delete(
  "/elections/:eid/voters/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (Object.getPrototypeOf(request.user) === Users.prototype) {
      try {
        await Voters.remove(request.params.id, request.params.eid);
        return response.json({ success: true });
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else {
      return response.status(403).json({
        status: "Forbidden",
        message:
          "Only authenticated administrators are authorized to delete voters resource",
      });
    }
  }
);

// NOTE Election preview page used to view the election page before launching
app.get(
  "/elections/:id/preview",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (Object.getPrototypeOf(request.user) === Users.prototype) {
      try {
        const election = await Elections.findByPk(request.params.id, {
          include: [{ model: Questions, include: Options }, { model: Voters }],
        });
        console.log(JSON.stringify(election, null, 2));
        return response.render("preview", {
          csrfToken: request.csrfToken(),
          user: request.user,
          election,
        });
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else {
      response.status(403).render("error", {
        code: "403",
        status: "Forbidden",
        message:
          "Only authenticated administrators are authorized to view dashboard",
      });
    }
  }
);

// NOTE Function to ensure voter loggedIn
function ensureVoterLoggedIn(request, response, next) {
  const callback = connectEnsureLogin.ensureLoggedIn(
    `/public/${request.params.id}`
  );
  return callback(request, response, next);
}

// NOTE Public login page to cast vote
app.get("/public/:id", async (request, response) => {
  try {
    const election = await Elections.findByPk(request.params.id, {
      include: [{ model: Questions, include: Options }, { model: Voters }],
    });
    if (election == null) {
      response.status(403).render("error", {
        code: "404",
        status: "Not Found",
        message: "Invalid Election Id",
      });
    } else if (!election.start) {
      response.status(403).render("error", {
        code: "403",
        status: "Forbidden",
        message:
          "Election is yet to start, can't cast votes before the election begins",
      });
    } else if (election.end) {
      response.redirect(`/elections/${request.params.id}/results`);
    } else {
      if (
        request.user &&
        Object.getPrototypeOf(request.user) === Voters.prototype
      ) {
        response.redirect(`/public/${request.params.id}/vote`);
      } else {
        response.render("public", {
          csrfToken: request.csrfToken(),
          user: request.user,
          election,
        });
      }
    }
  } catch (err) {
    console.log(err);
    response.status(400).render("error", {
      code: "400",
      status: "Bad request",
      message: err,
    });
  }
});

// NOTE Public vote page to fill your vote on election
app.get("/public/:id/vote", ensureVoterLoggedIn, async (request, response) => {
  if (Object.getPrototypeOf(request.user) === Voters.prototype) {
    try {
      const election = await Elections.findByPk(request.params.id, {
        include: [{ model: Questions, include: Options }, { model: Voters }],
      });

      if (!election.start) {
        response.status(403).render("error", {
          code: "403",
          status: "Forbidden",
          message:
            "Election is yet to start, can't cast votes before the election begins",
        });
      } else if (election.end) {
        response.redirect(`/elections/${request.params.id}/results`);
      }

      let voted = await Votes.haveAlreadyVoted(
        request.params.id,
        request.user.id
      );

      if (voted) {
        response.render("acknowledgement", {
          election,
          message:
            "You have already voted in this election! Revisit after the election ends to view the result!",
        });
      } else {
        response.render("vote", {
          csrfToken: request.csrfToken(),
          user: request.user,
          election,
        });
      }
    } catch (err) {
      console.log(err);
      response.status(400).render("error", {
        code: "400",
        status: "Bad request",
        message: err,
      });
    }
  } else {
    response.status(403).render("error", {
      code: "403",
      status: "Forbidden",
      message: "Only authenticated voters are authorized to fill a vote",
    });
  }
});

// NOTE Public vote page to cast your vote on election
app.post("/public/:id/cast", ensureVoterLoggedIn, async (request, response) => {
  if (Object.getPrototypeOf(request.user) === Voters.prototype) {
    try {
      const election = await Elections.findByPk(request.params.id);

      if (!election.start) {
        response.status(403).render("error", {
          code: "403",
          status: "Forbidden",
          message:
            "Election is yet to start, can't cast votes before the election begins",
        });
      } else if (election.end) {
        response.redirect(`/elections/${request.params.id}/results`);
      }

      let voted = await Votes.haveAlreadyVoted(
        request.params.id,
        request.user.id
      );
      if (voted) {
        response.render("acknowledgement", {
          election,
          message:
            "You have already voted in this election! Revisit after the election ends to view the result!",
        });
      } else {
        Object.keys(request.body).forEach(async (key) => {
          if (key.indexOf("question-") !== -1) {
            const questionKey = key.split("-");
            console.log({
              question: questionKey[questionKey.length - 1],
              option: request.body[key],
            });
            await Votes.createVote(
              request.body.electionId,
              questionKey[questionKey.length - 1],
              request.body[key],
              request.body.voterId
            );
          }
        });
        response.render("acknowledgement", {
          election,
          message: "Thank you for voting! Your vote has been recorded!",
        });
      }
    } catch (error) {
      console.log(error);
      return response.redirect(`/public/${request.params.eid}`);
    }
  } else {
    response.status(403).render("error", {
      code: "403",
      status: "Forbidden",
      message: "Only authenticated voters are authorized to cast a vote",
    });
  }
});

app.get("/elections/:id/results", async (request, response) => {
  try {
    const election = await Elections.findByPk(request.params.id, {
      include: [
        { model: Questions, include: [{ model: Options, include: Votes }] },
        { model: Voters, include: Votes },
      ],
    });

    if (election == null) {
      response.status(403).render("error", {
        code: "404",
        status: "Not Found",
        message: "Invalid Election Id",
      });
    } else if (
      ("user" in request &&
        Object.getPrototypeOf(request.user) === Users.prototype) ||
      election.end
    ) {
      let voteStat = { voted: 0, total: 0 };
      voteStat.total = election.Voters.length;
      election.Voters.forEach((voter) => {
        if (voter.Votes.length !== 0) voteStat.voted += 1;
      });
      console.log(JSON.stringify(election, null, 2));
      response.render("results", { voteStat, election });
    } else if (!election.end) {
      response.status(403).render("error", {
        code: "403",
        status: "Forbidden",
        message: "Please wait for the election to end",
      });
    } else {
      response.status(403).render("error", {
        code: "403",
        status: "Forbidden",
        message: "Only authenticated voters are authorized to view results",
      });
    }
  } catch (error) {
    console.log(error);
    return response.redirect(`/`);
  }
});

module.exports = app;
