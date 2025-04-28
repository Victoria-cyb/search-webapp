const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const typeDefs = require('./schemas/typeDefs');
const authResolvers = require('./resolvers/auth');
const imageResolvers = require('./resolvers/image');
const userResolvers = require('./resolvers/user');
const authMiddleware = require('./middleware/auth');
const connectDB = require('./config/db');
const User = require('./models/User');
const Download = require('./models/Download');
require('dotenv').config();

const app = express();

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

  const PORT = process.env.PORT || 6000;
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}${server.graphqlPath}`);
  });
};

startServer();