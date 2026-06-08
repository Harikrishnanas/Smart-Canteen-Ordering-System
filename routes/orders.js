const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const Payment = require('../models/Payment');
const MenuItem = require('../models/MenuItem');

// POST /api/orders - place new order
router.post('/', async (req, res) => {
    try {
        const { user_id, items, payment_mode } = req.body;

        if (!user_id || !items || items.length === 0 || !payment_mode) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Validate availability & calculate prep time
        let maxPrepTime = 0;
        for (let item of items) {
            const menuItem = await MenuItem.findById(item.item_id);
            if (!menuItem || menuItem.availability_status !== 'available') {
                return res.status(400).json({
                    error: `"${menuItem ? menuItem.item_name : 'An item'}" is no longer available. Please update your cart.`
                });
            }
            const itemPrepTime = menuItem.prep_time || 5;
            if (itemPrepTime > maxPrepTime) maxPrepTime = itemPrepTime;
        }

        // Create order
        const newOrder = new Order({
            user_id,
            estimated_waiting_time: maxPrepTime,
            order_status: 'Pending'
        });
        const savedOrder = await newOrder.save();

        // Create order items
        await OrderItem.insertMany(items.map(i => ({
            order_id: savedOrder._id,
            item_id: i.item_id,
            quantity: i.quantity
        })));

        // Create payment record
        const newPayment = new Payment({
            order_id: savedOrder._id,
            payment_mode,
            payment_status: payment_mode === 'online' ? 'success' : 'pending',
            payment_time: payment_mode === 'online' ? new Date() : null
        });
        await newPayment.save();

        res.status(201).json({
            message: 'Order placed successfully',
            order: savedOrder,
            payment: newPayment,
            serverTime: Date.now()
        });

    } catch (error) {
        console.error('Place order error:', error);
        res.status(500).json({ error: 'Failed to place order' });
    }
});

// GET /api/orders/user/:userId - user's orders
router.get('/user/:userId', async (req, res) => {
    try {
        const orders = await Order.find({ user_id: req.params.userId }).sort({ order_time: -1 });

        const enriched = await Promise.all(orders.map(async (order) => {
            const items = await OrderItem.find({ order_id: order._id }).populate('item_id');
            const payment = await Payment.findOne({ order_id: order._id });
            return { ...order.toObject(), items, payment };
        }));

        res.json({ orders: enriched, serverTime: Date.now() });
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// GET /api/orders/admin - all orders for admin
router.get('/admin', async (req, res) => {
    try {
        const orders = await Order.find().sort({ order_time: -1 }).populate('user_id', 'phone_email role');

        const enriched = await Promise.all(orders.map(async (order) => {
            const items = await OrderItem.find({ order_id: order._id }).populate('item_id');
            const payment = await Payment.findOne({ order_id: order._id });
            return { ...order.toObject(), items, payment };
        }));

        res.json(enriched);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to fetch admin orders' });
    }
});

// PUT /api/orders/:orderId/status - update status
router.put('/:orderId/status', async (req, res) => {
    try {
        const { status } = req.body;
        const order = await Order.findById(req.params.orderId);

        if (!order) return res.status(404).json({ error: 'Order not found' });

        // Only allow cancel if still Pending
        if (status === 'Cancelled' && order.order_status !== 'Pending') {
            return res.status(400).json({ error: 'Cannot cancel an order that has already started preparation.' });
        }

        if (status === 'Preparing') {
            order.preparation_start_time = new Date();
        }

        order.order_status = status;
        await order.save();

        // Handle rejection refund
        if (status === 'Rejected') {
            const payment = await Payment.findOne({ order_id: order._id });
            if (payment && payment.payment_status === 'success') {
                payment.payment_status = 'refunded';
                await payment.save();
            }
        }

        res.json({ message: `Order status updated to ${status}`, order });
    } catch (e) {
        res.status(500).json({ error: 'Failed to update status' });
    }
});

// GET /api/orders/cashier/pending - pending cash payments
router.get('/cashier/pending', async (req, res) => {
    try {
        const payments = await Payment.find({ payment_mode: 'cash', payment_status: 'pending' }).populate({
            path: 'order_id',
            populate: { path: 'user_id', select: 'phone_email' }
        });

        const enriched = await Promise.all(payments.map(async (payment) => {
            if (!payment.order_id) return payment;
            const items = await OrderItem.find({ order_id: payment.order_id._id }).populate('item_id');
            return { ...payment.toObject(), items };
        }));

        res.json(enriched);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch pending payments' });
    }
});

// GET /api/orders/cashier/refunds - cancelled/rejected orders needing refund
router.get('/cashier/refunds', async (req, res) => {
    try {
        const payments = await Payment.find({ payment_status: 'refunded' }).populate({
            path: 'order_id',
            populate: { path: 'user_id', select: 'phone_email' }
        });

        const enriched = await Promise.all(payments.map(async (payment) => {
            if (!payment.order_id) return payment;
            const items = await OrderItem.find({ order_id: payment.order_id._id }).populate('item_id');
            return { ...payment.toObject(), items };
        }));

        res.json(enriched);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch refunds' });
    }
});

// PUT /api/orders/cashier/confirm/:paymentId - confirm cash payment
router.put('/cashier/confirm/:paymentId', async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.paymentId);
        if (!payment) return res.status(404).json({ error: 'Payment not found' });

        payment.payment_status = 'success';
        payment.payment_time = new Date();
        await payment.save();

        res.json({ message: 'Payment confirmed', payment });
    } catch (e) {
        res.status(500).json({ error: 'Failed to confirm payment' });
    }
});

// PUT /api/orders/cashier/refund-done/:paymentId - mark refund as handled
router.put('/cashier/refund-done/:paymentId', async (req, res) => {
    try {
        const payment = await Payment.findByIdAndUpdate(
            req.params.paymentId,
            { payment_status: 'refund_completed' },
            { new: true }
        );
        if (!payment) return res.status(404).json({ error: 'Payment not found' });
        res.json({ message: 'Refund marked as completed', payment });
    } catch (e) {
        res.status(500).json({ error: 'Failed to mark refund' });
    }
});

module.exports = router;
