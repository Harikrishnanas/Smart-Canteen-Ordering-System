const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    phone_email: { type: String, required: true, unique: true },
    role: { type: String, enum: ['user', 'admin', 'cashier'], default: 'user' },
    password: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
