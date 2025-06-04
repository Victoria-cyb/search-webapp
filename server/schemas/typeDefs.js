const { gql } = require('apollo-server-express');

const typeDefs = gql`
type Image {
id: ID!
urls: ImageUrls!
alt_description: String
links: ImageLinks!
user: ImageUser!
}

type ImageUrls {
small: String!
regular: String!
full: String!
}

type ImageLinks {
html: String!
}

type ImageUser {
name: String!
}

type User {
id: ID!
username: String!
email: String!
favorites: [Image]
}

type Download {
id: ID!
url: String!
alt_description: String
timestamp: String!
}

type Query {
searchImages(query: String!, page: Int!, orientation: String, color: String, size: String): SearchResult!
getFavorites: [Image!]!
getDownloadHistory: [Download!]!
getUserProfile: User!
downloadImage(url: String!): String!
}

type Mutation {
login(email: String!, password: String!): AuthPayload!
googleLogin(googleToken: String!): AuthPayload!
register(username: String!, email: String!, password: String!): AuthPayload!
googleRegister(googleToken: String!): AuthPayload!
addFavorite(image: ImageInput!): FavoritePayload!
removeFavorite(imageId: ID!): FavoritePayload!
trackDownload(imageId: ID!, url: String!, alt_description: String): Download!
updateUserProfile(username: String, email: String): User!
clearDownloadHistory: [Download!]!
}

type SearchResult {
results: [Image!]!
total_pages: Int!
}

type AuthPayload {
token: String!
user: User!
}

type FavoritePayload {
favorites: [Image!]!
  }

input ImageInput {
id: ID!
urls: ImageUrlsInput!
alt_description: String
links: ImageLinksInput!
user: ImageUserInput!
}

input ImageUrlsInput {
small: String!
regular: String!
full: String!
}

input ImageLinksInput {
    html: String!
  }

  input ImageUserInput {
    name: String!
  }
    type PinterestImage {
    id: ID!
    src: String!
    alt: String
    query: String!
    timestamp: String!
  }

  type PinterestImageResponse {
    message: String!
    images: [PinterestImage!]
  }

  extend type Query {
    getPinterestImages(query: String, limit: Int): [PinterestImage!]
  }

  extend type Mutation {
    scrapePinterestImages(query: String!, limit: Int): PinterestImageResponse!
  }
`;

module.exports = typeDefs;