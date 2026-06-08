const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
    item_name: { type: String, required: true },
    price: { type: Number, required: true },
    category: {
        type: String,
        enum: ['Main Course', 'Snacks', 'Beverages', 'Desserts', 'Salads', 'Sides'],
        default: 'Main Course'
    },
    availability_status: {
        type: String,
        enum: ['available', 'unavailable'],
        default: 'available'
    },
    image_url: { type: String },
    prep_time: { type: Number, default: 5 }
}, { timestamps: true });

module.exports = mongoose.model('MenuItem', menuItemSchema);
