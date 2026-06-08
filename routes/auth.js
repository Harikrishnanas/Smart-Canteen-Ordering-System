const express = require('express');
const router = express.Router();
const User = require('../models/User');

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { role, identifier, password } = req.body;

        if (!role) return res.status(400).json({ error: 'Role is required' });

        if (role === 'student') {
            if (!identifier) return res.status(400).json({ error: 'Email or phone required' });

            const isPhone = /^\d{10}$/.test(identifier);
            const isEmail = /^[a-zA-Z0-9+_.-]+@gmail\.com$/.test(identifier);

            if (!isPhone && !isEmail) {
                return res.status(400).json({ error: 'Enter a valid 10-digit phone or @gmail.com email.' });
            }

            let user = await User.findOne({ phone_email: identifier, role: 'user' });
            if (!user) {
                user = await User.create({ phone_email: identifier, role: 'user' });
            }
            return res.status(200).json({ message: 'Login successful', user });

        } else if (role === 'admin' || role === 'cashier') {
            if (!identifier || !password) {
                return res.status(400).json({ error: 'Username and password required' });
            }
            const user = await User.findOne({ phone_email: identifier, role: role });
            if (!user || user.password !== password) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            return res.status(200).json({ message: 'Login successful', user });
        } else {
            return res.status(400).json({ error: 'Invalid role' });
        }

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

module.exports = router;
