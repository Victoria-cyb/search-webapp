const authResolvers = require('./auth');
const imageResolvers = require('./image');
const userResolvers = require('./user');
const pinterestImageResolvers = require('./pinterest');

module.exports = {
  Query: {
    ...authResolvers.Query,
    ...imageResolvers.Query,
    ...userResolvers.Query,
    ...pinterestImageResolvers.Query,

  },
  Mutation: {
    ...authResolvers.Mutation,
    ...imageResolvers.Mutation,
    ...userResolvers.Mutation,
    ...pinterestImageResolvers.Mutation,
  },
};