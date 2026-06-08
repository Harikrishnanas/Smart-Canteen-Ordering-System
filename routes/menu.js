const express = require('express');
const router = express.Router();
const MenuItem = require('../models/MenuItem');
const multer = require('multer');
const path = require('path');

// Multer setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../public/uploads/')),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

// GET /api/menu - for students (available items only)
router.get('/', async (req, res) => {
    try {
        const items = await MenuItem.find({ availability_status: 'available' });
        res.json(items);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch menu' });
    }
});

// GET /api/menu/admin - for admin (all items)
router.get('/admin', async (req, res) => {
    try {
        const items = await MenuItem.find();
        res.json(items);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch menu' });
    }
});

// POST /api/menu/admin - add item
router.post('/admin', upload.single('image'), async (req, res) => {
    try {
        const { item_name, price, availability_status, prep_time, category } = req.body;
        const image_url = req.file ? `/uploads/${req.file.filename}` : '';

        const item = new MenuItem({
            item_name,
            price: Number(price),
            availability_status: availability_status || 'available',
            prep_time: Number(prep_time) || 5,
            category: category || 'Main Course',
            image_url
        });
        await item.save();
        res.status(201).json({ message: 'Item added', item });
    } catch (e) {
        console.error('Add item error:', e);
        res.status(500).json({ error: 'Failed to add item' });
    }
});

// PUT /api/menu/admin/update/:id - full update (edit)
router.put('/admin/update/:id', upload.single('image'), async (req, res) => {
    try {
        const { item_name, price, availability_status, prep_time, category } = req.body;
        const fields = {
            item_name,
            price: Number(price),
            availability_status,
            prep_time: Number(prep_time),
            category
        };
        if (req.file) fields.image_url = `/uploads/${req.file.filename}`;

        const item = await MenuItem.findByIdAndUpdate(req.params.id, fields, { new: true });
        if (!item) return res.status(404).json({ error: 'Item not found' });
        res.json({ message: 'Item updated', item });
    } catch (e) {
        res.status(500).json({ error: 'Failed to update item' });
    }
});

// PUT /api/menu/admin/:id - toggle availability
router.put('/admin/:id', async (req, res) => {
    try {
        const { availability_status } = req.body;
        const item = await MenuItem.findByIdAndUpdate(req.params.id, { availability_status }, { new: true });
        if (!item) return res.status(404).json({ error: 'Item not found' });
        res.json({ message: 'Availability updated', item });
    } catch (e) {
        res.status(500).json({ error: 'Failed to update' });
    }
});

// DELETE /api/menu/admin/:id - delete item
router.delete('/admin/:id', async (req, res) => {
    try {
        const item = await MenuItem.findByIdAndDelete(req.params.id);
        if (!item) return res.status(404).json({ error: 'Item not found' });
        res.json({ message: 'Item deleted' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete item' });
    }
});

module.exports = router;
