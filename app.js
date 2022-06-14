require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');

const app = express();

app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: false,
}));
app.use(passport.authenticate('session'));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect('mongodb://localhost:27017/userDB');

const userSchema = new mongoose.Schema ({
  email: String,
  password: String,
  googleId: String,
  secret: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = mongoose.model('User', userSchema);

passport.use(User.createStrategy());

// should work with any kind of authentication
// passport.serializeUser(function (user, cb) {
//   process.nextTick(function () {
//     cb(null, { id: user.id, username: user.username, name: user.displayName });
//   });
// });

// passport.deserializeUser(function (user, cb) {
//   process.nextTick(function () {
//     return cb(null, user);
//   });
// });

passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  User.findById(id, function (err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: 'http://localhost:3000/auth/google/classifyed',
},
  function (accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));


app.get('/', (req, res) => {
  res.render('home');
});

// ==> send user To Google Auth
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile'] })
);

// <== return user From Google Auth
app.get('/auth/google/classifyed',
  passport.authenticate('google', { failureRedirect: '/login' }),
  function (req, res) {
    // Successful authentication, redirect to classifyed page.
    res.redirect('/classifyed');
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.get('/register', (req, res) => {
  res.render('register');
});

app.get('/classifyed', (req, res) => {
  User.find({ 'secret': { $ne: null } }, (err, foundUsers) => {
    if (err) {
      console.log(err);
    } else {
      if (foundUsers) {
        res.render('classifyed', { usersWithSecrets: foundUsers });
      }
    }
  });
});

app.get('/submit', (req, res) => {
  if (req.isAuthenticated()) {
    res.render('submit');
  } else {
    res.redirect('/login');
  }
});

app.post('/submit', (req, res) => {
  const submittedSecret = req.body.secret;

  console.log(req.user.id);

  User.findById(req.user.id, function (err, foundUser) {
    if (err) {
      console.log(err);
    } else {
      if (foundUser) {
        foundUser.secret = submittedSecret;
        foundUser.save(() => {
          res.redirect('/classifyed');
        });
      }
    }
  });
});

// logout() is now async (ver. 0.6.0+), so we need to use a callback
app.get('/logout', function (req, res, next) {
  req.logout(function (err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

app.post('/register', (req, res) => {
  User.register({ username: req.body.username }, req.body.password, (err, user) => {
    if (err) {
      console.log(err);
      res.redirect('/register');
    } else {
      passport.authenticate('local')(req, res, () => {
        res.redirect('/classifyed');
      });
    }
  });
});

app.post('/login', (req, res) => {
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });
  req.login(user, (err) => {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate('local')(req, res, () => {
        res.redirect('/classifyed');
      });
    }
  });
});


app.listen(3000, () => {
  console.log(`The server started on port 3000! Betta Go Catch It!`);
});