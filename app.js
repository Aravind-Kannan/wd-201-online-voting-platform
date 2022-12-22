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
            else return done(null, false, { message: "Invalid Password" });
          } else {
            return done(null, false, { message: "Invalid Email" });
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
            else return done(null, false, { message: "Invalid Password" });
          } else {
            return done(null, false, { message: "Invalid Voter Id" });
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
    console.log(error);
    request.flash("error", error.errors[0].message);
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
        return response.redirect("/dashboard");
      } catch (error) {
        console.log(error);
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
        updated = false;
      try {
        if ("name" in request.body) {
          updatedElection = await election.updateName(request.body.name);
          updated = true;
        }

        if ("start" in request.body) {
          updatedElection = await election.updateStart(request.body.start);
          updated = true;
        }

        if ("end" in request.body) {
          updatedElection = await election.updateEnd(request.body.end);
          updated = true;
        }

        if (!updated)
          return response
            .status(422)
            .json({ message: "Missing name, start and/or end property" });

        return response.json(updatedElection);
      } catch (error) {
        console.log(error);
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
          request.body.password,
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
  const election = await Elections.findByPk(request.params.id, {
    include: [{ model: Questions, include: Options }, { model: Voters }],
  });
  if (election.start) {
    response.render("public", {
      csrfToken: request.csrfToken(),
      user: request.user,
      election,
    });
  } else {
    response.status(403).render("error", {
      code: "403",
      status: "Forbidden",
      message:
        "Election is yet to start, can't cast votes before the election begins",
    });
  }
});

// NOTE Public vote page to fill your vote on election
app.get("/public/:id/vote", ensureVoterLoggedIn, async (request, response) => {
  if (Object.getPrototypeOf(request.user) === Voters.prototype) {
    const election = await Elections.findByPk(request.params.id, {
      include: [{ model: Questions, include: Options }, { model: Voters }],
    });
    let voted = await Votes.haveAlreadyVoted(
      request.params.id,
      request.user.id
    );
    if (voted) {
      if (election.end)
        response.redirect(`/public/${request.params.id}/result`);
      response.render("acknowledgement", {
        election,
        message: "You have already voted in this election!",
      });
    } else {
      response.render("vote", {
        csrfToken: request.csrfToken(),
        user: request.user,
        election,
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
      let voted = await Votes.haveAlreadyVoted(
        request.params.id,
        request.user.id
      );
      if (voted) {
        response.render("acknowledgement", {
          election,
          message: "You have already voted in this election!",
        });
      } else {
        Object.keys(request.body).forEach(async (key) => {
          if (key.indexOf("question-") !== -1) {
            console.log({
              question: key.split("-").at(-1),
              option: request.body[key],
            });
            await Votes.createVote(
              request.body.electionId,
              key.split("-").at(-1),
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

// app.post(
//   "/public/:id/result",
//   connectEnsureLogin.ensureLoggedIn(),
//   async (request, response) => {
//     // If user is Admin allow always, if user is Voter check if election over
//   }
// );

module.exports = app;
