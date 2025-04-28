const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { UserInputError, AuthenticationError } = require('apollo-server-express');
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const auth = {
    Mutation: {
        register: async (_, { username, email, password }, { User }) => {
          const existingUser = await User.findOne({ $or: [{ email }, { username }] });
          if (existingUser) {
            throw new UserInputError('Username or email already exists');
          }
    
          const hashedPassword = await bcrypt.hash(password, 10);
          const user = new User({
            username,
            email,
            password: hashedPassword,
          });
          await user.save();
    
          const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
          return { token, user };
        },

        login: async (_, { email, password }, { User }) => {
            const user = await User.findOne({ email });
            if (!user) {
              throw new AuthenticationError('Invalid credentials');
            }
      
            if (!user.password) {
              throw new AuthenticationError('Use Google login for this account');
            }
      
            const valid = await bcrypt.compare(password, user.password);
            if (!valid) {
              throw new AuthenticationError('Invalid credentials');
            }
      
            const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
            return { token, user };
          },

          googleRegister: async (_, { googleToken }, { User }) => {
            try {
              const ticket = await client.verifyIdToken({
                idToken: googleToken,
                audience: process.env.GOOGLE_CLIENT_ID,
              });
              const payload = ticket.getPayload();
              const { email, name } = payload;
      
              let user = await User.findOne({ email });
              if (user) {
                throw new UserInputError('User already exists. Please log in.');
              }

              const username = name.replace(/\s/g, '').toLowerCase().slice(0, 20);
        let uniqueUsername = username;
        let counter = 1;
        while (await User.findOne({ username: uniqueUsername })) {
          uniqueUsername = `${username}${counter}`;
          counter++;
        }

        user = new User({
          username: uniqueUsername,
          email,
          password: '', // No password for Google users
        });
        await user.save();

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        return { token, user };
      } catch (error) {
        throw new AuthenticationError(error.message || 'Google registration failed');
      }
    },

    googleLogin: async (_, { googleToken }, { User }) => {
        try {
          const ticket = await client.verifyIdToken({
            idToken: googleToken,
            audience: process.env.GOOGLE_CLIENT_ID,
          });
          const payload = ticket.getPayload();
          const { email } = payload;
  
          const user = await User.findOne({ email });
          if (!user) {
            throw new AuthenticationError('User not found. Please register.');
          }
  
          const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
          return { token, user };
        } catch (error) {
          throw new AuthenticationError(error.message || 'Google login failed');
        }
      },
    },
};

module.exports = auth;