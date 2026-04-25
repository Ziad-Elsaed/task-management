require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const { body, param } = require('express-validator');

const User = require('./models/User');
const Task = require('./models/Task');
const authMiddleware = require('./middleware/auth');
const validate = require('./middleware/validate');

const app = express();

app.use(cors({
    origin: '*'
}));
app.use(express.json());

// set dns manually to google 8.8.8.8
require('dns').setServers(['8.8.8.8']);

// // 🔹 DB
// mongoose.connect(process.env.MONGO_URI)
//     .then(() => console.log("MongoDB Connected"))
//     .catch(err => console.log(err));

/* =========================
   🔹 AUTH ROUTES
========================= */

let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;

  try {
    const db = await mongoose.connect(process.env.MONGO_URI);
    isConnected = db.connections[0].readyState;
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error:", err);
  }
};

app.use(async (req, res, next) => {
  await connectDB();
  next();
});

// ✅ Register
app.post(
    '/auth/register',
    [
        body('name').notEmpty().withMessage('Name is required'),
        body('email').isEmail().withMessage('Valid email required'),
        body('password')
            .isLength({ min: 6 })
            .withMessage('Password must be at least 6 characters')
    ],
    validate,
    async (req, res, next) => {
        const { name, email, password } = req.body;

        try {
            const existingUser = await User.findOne({ email });

            if (existingUser) {
                return res.status(400).json({ message: "Email already exists" });
            }

            await User.create({ name, email, password });

            res.json({ message: "User created successfully" });

        } catch (err) {
            next(err);
        }
    }
);

// ✅ Login
app.post(
    '/auth/login',
    [
        body('email').isEmail().withMessage('Valid email required'),
        body('password').notEmpty().withMessage('Password is required')
    ],
    validate,
    async (req, res, next) => {
        const { email, password } = req.body;

        try {
            const user = await User.findOne({ email, password });

            if (!user) {
                return res.status(401).json({ message: "Invalid email or password" });
            }

            const token = jwt.sign(
                { id: user._id, email: user.email },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );

            res.json({ token });

        } catch (err) {
            next(err);
        }
    }
);

/* =========================
   🔹 TASK ROUTES
========================= */

// ✅ Get tasks
app.get('/tasks', authMiddleware, async (req, res) => {
    const tasks = await Task.find({ userId: req.user.id });
    res.json(tasks);
});

// ✅ Add task
app.post(
    '/tasks',
    authMiddleware,
    [
        body('title').notEmpty().withMessage('Task title is required')
    ],
    validate,
    async (req, res) => {
        const { title } = req.body;

        const task = await Task.create({
            title,
            userId: req.user.id
        });

        res.json({ message: "Task created successfully", task });
    }
);

// ✅ Delete task
app.delete('/tasks/:id', authMiddleware,
    [
        param('id')
            .isMongoId()
            .withMessage('Invalid task ID')
    ], validate, async (req, res) => {
        const task = await Task.findOneAndDelete({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        res.json({ message: "Task deleted" });
    });

/* ========================= */

// const PORT = 3000;
// app.listen(PORT, () => {
//     console.log(`Server running on http://localhost:${PORT}`);
// });

app.use((err, req, res, next) => {
    console.error("GLOBAL ERROR:", err);
    console.error(err.stack);

    res.status(500).json({
        message: err.message || "Something went wrong"
    });
});

module.exports = app;
