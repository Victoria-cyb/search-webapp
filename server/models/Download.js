const mongoose = require('mongoose');

const DownloadSchema = new mongoose.Schema({
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    imageId: {
      type: String,
      required: true,
    },

    url: {
      type: String,
      required: true,
    },

    alt_description: {
        type: String,
    },

    timestamp: {
        type: Date,
        default: Date.now,
    },
}, { timestamps: true });



const Download = mongoose.model('Download', DownloadSchema);

module.exports = Download;