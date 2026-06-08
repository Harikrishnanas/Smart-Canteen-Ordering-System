const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    payment_mode: { type: String, enum: ['online', 'cash'], required: true },
    payment_status: { type: String, default: 'pending' }, // pending, success, refunded
    payment_time: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
