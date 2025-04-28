const fetch = require('node-fetch');
const { AuthenticationError } = require('apollo-server-express');

const image = {
    Query: {
        searchImages: async (_, { query, page, orientation, color, size }, { user }) => {
          if (!user) {
            throw new AuthenticationError('You must be logged in to search images');
          }
    
          const url = new URL('https://api.unsplash.com/search/photos');
          url.searchParams.append('query', query);
          url.searchParams.append('page', page);
          url.searchParams.append('per_page', 10);
          if (orientation) url.searchParams.append('orientation', orientation);
          if (color) url.searchParams.append('color', color);
          // Note: Size is handled client-side due to Unsplash API limitations
    
          try {
            const response = await fetch(url, {
              headers: {
                Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
              },
            });
            if (!response.ok) {
              throw new Error(`Unsplash API error: ${response.statusText}`);
            }
            const data = await response.json();
            return {
              results: data.results.map((item) => ({
                id: item.id,
            urls: {
              small: item.urls.small,
              regular: item.urls.regular,
              full: item.urls.full,
            },
            alt_description: item.alt_description,
            links: { html: item.links.html },
            user: { name: item.user.name },
          })),
          total_pages: data.total_pages,
        };
      } catch (error) {
        throw new Error(`Failed to fetch images: ${error.message}`);
      }
    },

    getFavorites: async (_, __, { user, User }) => {
      if (!user) {
        throw new AuthenticationError('You must be logged in to view favorites');
      }
      const currentUser = await User.findById(user.userId);
      return currentUser.favorites;
    },
  },

  Mutation: {
    addFavorite: async (_, { image }, { user, User }) => {
      if (!user) {
        throw new AuthenticationError('You must be logged in to add favorites');
      }
      const currentUser = await User.findById(user.userId);
      if (!currentUser.favorites.find((f) => f.id === image.id)) {
        currentUser.favorites.push(image);
        await currentUser.save();
      }
      return { favorites: currentUser.favorites };
    },

    removeFavorite: async (_, { imageId }, { user, User }) => {
      if (!user) {
        throw new AuthenticationError('You must be logged in to remove favorites');
      }
      const currentUser = await User.findById(user.userId);
      currentUser.favorites = currentUser.favorites.filter((f) => f.id !== imageId);
      await currentUser.save();
      return { favorites: currentUser.favorites };
    },
  },
};


module.exports = image;
    