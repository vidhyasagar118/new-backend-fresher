import express from "express";
import mongoose from "mongoose";
import { MongoClient } from "mongodb";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ===== ES MODULE FIX =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== STATIC IMAGES =====
app.use("/images", express.static(path.join(__dirname, "images")));

// ===================================================
// =============== DB CONNECTIONS =====================
// ===================================================

async function connectDatabases() {
  try {
    // ✅ DB1 — Mongoose (schoolweb)
    await mongoose.connect(process.env.MONGO_URI_AUTH);
    console.log("✅ Auth DB connected (schoolweb)");

    // ✅ DB2 — MongoClient (formdata)
    const client = new MongoClient(process.env.MONGO_URI_FORM);
    await client.connect();
    const formDB = client.db("formdata");
    console.log("✅ Form DB connected (formdata)");

    // start server AFTER DB connected
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));

    // expose db globally
    app.locals.formDB = formDB;

  } catch (err) {
    console.error("❌ Database connection failed:", err);
    process.exit(1);
  }
}

connectDatabases();

// ===================================================
// ================= MONGOOSE MODELS =================
// ===================================================

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  phone: { type: String, unique: true },
  password: String,
  otp: String,
  otpExpire: Date,
  isVerified: { type: Boolean, default: false },
});

const User = mongoose.model("User", userSchema);

const contactSchema = new mongoose.Schema({
  name: String,
  phone: String,
  email: String,
  message: String,
  createdAt: { type: Date, default: Date.now },
});

const Contact = mongoose.model("Contact", contactSchema);

// ===================================================
// ================= CONTACT ROUTE ===================
// ===================================================

app.post("/api/contact", async (req, res) => {
  try {
    const contact = new Contact(req.body);
    await contact.save();
    res.status(201).json({ message: "Message sent successfully" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Contact failed" });
  }
});

// ===================================================
// ================= AUTH ROUTES ======================
// ===================================================

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: "All fields required" });

    const exists = await User.findOne({ email });
    if (exists)
      return res.status(400).json({ message: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);

    await User.create({
      name,
      email,
      phone,
      password: hashed,
      isVerified: true, // OTP skip for now
    });

    res.status(201).json({ message: "Signup successful" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Signup failed" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "User not found" });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({ token, user });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Login failed" });
  }
});

// ===================================================
// ================= FORM / VOTE DB ==================
// ===================================================

app.get("/students", async (req, res) => {
  try {
    const db = app.locals.formDB;
    const students = await db.collection("votesection").find().toArray();
    res.json(students);
  } catch {
    res.status(500).json({ message: "Failed to fetch students" });
  }
});

app.post("/vote", async (req, res) => {
  try {
    const db = app.locals.formDB;
    const { email, enrollmentnum } = req.body;

    const voted = await db.collection("votes").findOne({ email });
    if (voted) return res.status(400).json({ message: "Already voted" });

    await db.collection("votes").insertOne({ email, enrollmentnum });
    await db.collection("votesection").updateOne(
      { enrollmentnum },
      { $inc: { votes: 1 } }
    );

    res.json({ message: "Vote successful" });
  } catch {
    res.status(500).json({ message: "Vote failed" });
  }
});

app.get("/vote/status/:email", async (req, res) => {
  const db = app.locals.formDB;
  const vote = await db.collection("votes").findOne({ email: req.params.email });
  res.json({ hasVoted: !!vote });
});

app.get("/students/top", async (req, res) => {
  try {
    const db = app.locals.formDB;
    const topStudents = await db
      .collection("votesection")
      .find()
      .sort({ votes: -1 })
      .limit(5)
      .toArray();

    res.json(topStudents);
  } catch {
    res.status(500).json({ message: "Failed to fetch top students" });
  }
});
