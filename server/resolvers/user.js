const { AuthenticationError } = require('apollo-server-express');
const User = require('../models/User');
const Download = require('../models/Download');

const user = {
    Query: {
        getUserProfile: async (_, __, { user }) => {
          console.log('getUserProfile: context.user =', user);
          if (!user) {
            throw new AuthenticationError('You must be logged in to view profile');
          }
          if (!user.userId) {
            throw new AuthenticationError('Invalid user data in token');
          }
          const currentUser = await User.findById(user.userId);
          console.log('getUserProfile: currentUser =', currentUser); // Debug log
          if (!currentUser) {
            throw new AuthenticationError('User not found');
          }
          return currentUser;
        },
    
        getDownloadHistory: async (_, __, { user }) => {
          if (!user) {
            throw new AuthenticationError('You must be logged in to view download history');
          }
          const downloads = await Download.find({ userId: user.userId }).sort({ timestamp: -1 });
          return downloads.map((d) => ({
            id: d._id,
            url: d.url,
            alt_description: d.alt_description,
            timestamp: d.timestamp.toISOString(),
          }));
        },
      },

      Mutation: {
        trackDownload: async (_, { imageId, url, alt_description }, { user, Download }) => {
          if (!user) {
            throw new AuthenticationError('You must be logged in to track downloads');
          }
          const download = new Download({
            userId: user.userId,
            imageId,
            url,
            alt_description,
            timestamp: new Date(),
          });
          await download.save();
          return {
            id: download._id,
            url: download.url,
            alt_description: download.alt_description,
            timestamp: download.timestamp.toISOString(),
          };
        },
      },
};

module.exports = user;