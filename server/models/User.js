const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
username: {
type: String,
required: true,
unique: true,
trim: true,
minlength: 3,
},

email: {
type: String,
required: true,
unique: true,
trim: true,
},

password: {
type: String,
required: false, // Optional for Google OAuth users
},

favorites: [
{
id: String,
urls: {
small: String,
regular: String,
full: String,
},
alt_description: String,
links: { html: String },
user: { name: String },
},
],

}, { timestamps: true });


const User = mongoose.model('User', UserSchema);
module.exports = User;