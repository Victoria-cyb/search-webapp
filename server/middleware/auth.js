const jwt = require('jsonwebtoken');
const { AuthenticationError } = require('apollo-server-express');

const authMiddleware = ({ req }) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || '';
  if (!token) {
    return { user: null };
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return { user: decoded };
  } catch (error) {
    throw new AuthenticationError('Invalid or expired token');
  }
};

module.exports = authMiddleware;