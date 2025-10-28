// Load env first
require('dotenv').config();

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cors = require('cors');

app.use(cors());
app.use(express.json());

process.on('uncaughtException', (err) => {
  console.error('UncaughtException:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('UnhandledRejection:', err);
});

// Read env vars with sane defaults
const {
  NODE_ENV = 'development',
  PORT = 5000,
  MONGODB_URI,
  JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET,
  ACCESS_TOKEN_TTL = '20s'
} = process.env;

// Basic guardrails if critical vars are missing
if (!MONGODB_URI) {
  console.error("Missing MONGODB_URI in environment");
  process.exit(1);
}
if (!JWT_ACCESS_SECRET || !JWT_REFRESH_SECRET) {
  console.error("Missing JWT secrets in environment");
  process.exit(1);
}

// Retry Mongo connect instead of exiting once
const connectWithRetry = async (retries = 10, delayMs = 2000) => {
  for (let i = 1; i <= retries; i++) {
    try {
      await mongoose.connect(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log("MongoDB connected");
      return;
    } catch (err) {
      console.error(`Mongo connect failed (attempt ${i}/${retries}):`, err.message);
      if (i === retries) process.exit(1);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
};
connectWithRetry();

// Optional: Health endpoint
app.get("/api/health", (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  if (ready) return res.status(200).json({ status: "ok" });
  return res.status(503).json({ status: "starting" });
});

// Define User schema and model
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isAdmin: { type: Boolean, default: false },
});
const User = mongoose.model("User", userSchema);

// In-memory refresh token store (for demo/dev)
let refreshTokens = [];

// Token helpers
const generateAccessToken = (user) =>
  jwt.sign({ id: user._id, isAdmin: user.isAdmin }, JWT_ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_TTL });

const generateRefreshToken = (user) =>
  jwt.sign({ id: user._id, isAdmin: user.isAdmin }, JWT_REFRESH_SECRET);

// Register
app.post("/api/register", async (req, res) => {
  try {
    const { username, password, isAdmin } = req.body;
    const existingUser = await User.findOne({ name: username });
    if (existingUser) return res.status(400).json("Username already taken");

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      name: username,
      password: hashedPassword,
      isAdmin: isAdmin || false,
    });

    await newUser.save();
    res.status(201).json("User registered successfully");
  } catch (err) {
    console.error(err);
    res.status(500).json("Server error");
  }
});

// Login
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ name: username });
    if (!user) return res.status(400).json("Username or password incorrect");

    const validPass = await bcrypt.compare(password, user.password);
    if (!validPass) return res.status(400).json("Username or password incorrect");

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    refreshTokens.push(refreshToken);

    res.json({
      username: user.name,
      isAdmin: user.isAdmin,
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json("Server error");
  }
});

// Refresh
app.post("/api/refresh", (req, res) => {
  const refreshToken = req.body.token;
  if (!refreshToken) return res.status(401).json("You are not authenticated");
  if (!refreshTokens.includes(refreshToken)) {
    return res.status(403).json("Refresh token is not valid");
  }
  jwt.verify(refreshToken, JWT_REFRESH_SECRET, (err, user) => {
    if (err) return res.status(403).json("Refresh token is not valid");
    refreshTokens = refreshTokens.filter((t) => t !== refreshToken);

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);
    refreshTokens.push(newRefreshToken);

    res.status(200).json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  });
});

// Middleware for access token
const verify = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(" ")[1];
    jwt.verify(token, JWT_ACCESS_SECRET, (err, user) => {
      if (err) return res.status(403).json("Token is not valid");
      req.user = user;
      next();
    });
  } else {
    res.status(401).json("You are not authenticated");
  }
};

// Logout
app.post("/api/logout", (req, res) => {
  const refreshToken = req.body.token;
  refreshTokens = refreshTokens.filter((t) => t !== refreshToken);
  res.status(200).json("You have been logged out");
});

// Delete user
app.delete("/api/users/:userID", verify, async (req, res) => {
  if (req.user.id === req.params.userID || req.user.isAdmin) {
    try {
      await User.findByIdAndDelete(req.params.userID);
      res.status(200).json("User has been deleted");
    } catch (err) {
      res.status(500).json("Error deleting user");
    }
  } else {
    res.status(403).json("You are not allowed to delete the user");
  }
});

app.listen(PORT, () =>
  console.log(`Backend running on http://localhost:${PORT} (${NODE_ENV})`)
);
