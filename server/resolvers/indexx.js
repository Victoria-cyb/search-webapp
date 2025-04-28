const authResolvers = require('./auth');
const imageResolvers = require('./image');
const userResolvers = require('./user');

module.exports = {
  Query: {
    ...authResolvers.Query,
    ...imageResolvers.Query,
    ...userResolvers.Query,
  },
  Mutation: {
    ...authResolvers.Mutation,
    ...imageResolvers.Mutation,
    ...userResolvers.Mutation,
  },
};