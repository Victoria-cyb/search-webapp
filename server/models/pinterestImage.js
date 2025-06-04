const mongoose = require('mongoose');

const PinterestImageSchema = new mongoose.Schema({
  src: { type: String, required: true },
  alt: { type: String },
  query: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Optional: Link to user
});

const PinterestImage = mongoose.model('PinterestImage', PinterestImageSchema);

module.exports = PinterestImage