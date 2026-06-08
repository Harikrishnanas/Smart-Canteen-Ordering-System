const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    order_status: {
        type: String,
        enum: ['Pending', 'Preparing', 'Ready for Pickup', 'Completed', 'Cancelled', 'Rejected'],
        default: 'Pending'
    },
    estimated_waiting_time: { type: Number, default: 0 }, // in minutes
    order_time: { type: Date, default: Date.now },
    preparation_start_time: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
