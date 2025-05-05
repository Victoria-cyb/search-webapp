require('dotenv').config();
const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const cors = require('cors');
const passport = require('passport');
const session = require('express-session');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require ('jsonwebtoken');
const typeDefs = require('./schemas/typeDefs');
const authResolvers = require('./resolvers/auth');
const imageResolvers = require('./resolvers/image');
const userResolvers = require('./resolvers/user');
const authMiddleware = require('./middleware/auth');
const connectDB = require('./config/db');
const User = require('./models/User');
const Download = require('./models/Download');
const axios = require('axios');



const app = express();

function createJwtToken(user) {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      name: user.name,
    },
    process.env.JWT_SECRET || 'fallback_jwt_secret',
    { expiresIn: '7d' }
  );
}

app.use(session({
  secret: process.env.SESSION_SECRET || 'myDefaultSessionSecret',
  resave: false,
  saveUninitialized: true,
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: 'https://search-webapp.onrender.com/auth/google/callback',
},

 async (accessToken, refreshToken, profile, done) => {

  try {
    console.log('Google profile:', profile);
    let user = await User.findOne({ googleId: profile.id });
    if (!user) {
      user = await User.findOne({ email: profile.emails[0].value }) ; // Use email prefix as username

      if (user) {
        // Link the Google ID to the existing user
        user = await User.findOneAndUpdate(
          { email: profile.emails[0].value },
          { $set: { googleId: profile.id } },
          { new: true }
        );
      } else {
        // Generate a username
        const baseUsername = profile.emails[0].value.split('@')[0];
        const uniqueSuffix = Date.now().toString().slice(-4);
        const username = `${baseUsername}_${uniqueSuffix}`;

        user = await User.create({
          googleId: profile.id,
          email: profile.emails[0].value,
          name: profile.displayName,
          username,
        });
      }
    }
    done(null, user);
  } catch (err) {
    console.error('OAuth callback error:', err); // Log the actual error
    done(err);
  }
  
  

  
}));

app.use(cors({ origin: '*', credentials: true })); // Allow all origins for CORS

app.get('/auth/google', 
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  function (req, res) {
    console.log('Callback route hit');
    console.log('Logged-in user:', req.user);
    try {
      if (!req.user) {
        console.error('No user in request');
        return res.status(500).send('Internal Error: No user');
      }

      const token = createJwtToken(req.user); //  Uses the function defined above
      console.log('Token generated:', token);

      

      res.redirect(`https://search-webapp-ten.vercel.app/search.html?token=${token}`);
    } catch (err) {
      console.error('JWT creation or redirect error:', err);
      res.status(500).send('Internal Server Error during redirect');
    }
  }
);

const resolvers = {
  Query: {
    ...imageResolvers.Query,
    ...userResolvers.Query,
  },
  Mutation: {
    ...authResolvers.Mutation,
    ...imageResolvers.Mutation,
    ...userResolvers.Mutation,
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: ({ req }) => {
    const { user } = authMiddleware({ req });
    return { user, User, Download };
  },
});

const startServer = async () => {
  await connectDB();
  await server.start();
  server.applyMiddleware({ app });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}${server.graphqlPath}`);
  });
};

startServer();