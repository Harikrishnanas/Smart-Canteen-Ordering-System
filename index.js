require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const User = require('./models/User');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files - no caching for development
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  }
}));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB');
    await seedDefaultUsers();
  })
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// Seed default Admin and Cashier users
async function seedDefaultUsers() {
  try {
    const adminExists = await User.findOne({ role: 'admin' });
    if (!adminExists) {
      await User.create({
        phone_email: 'admin',
        role: 'admin',
        password: process.env.ADMIN_PASSWORD
      });
      console.log('🔑 Default Admin created ');
    }

    const cashierExists = await User.findOne({ role: 'cashier' });
    if (!cashierExists) {
      await User.create({
        phone_email: 'cashier',
        role: 'cashier',
        password: process.env.CASHIER_PASSWORD
      });
      console.log('🔑 Default Cashier created ');
    }
  } catch (error) {
    console.error('Error seeding default users:', error);
  }
}

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/menu', require('./routes/menu'));
app.use('/api/orders', require('./routes/orders'));

// Root redirect
app.get('/', (req, res) => res.redirect('/login.html'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
