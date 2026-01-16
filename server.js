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
app.use("/images", express.static(path.join(__dirname, "images")));

// ===================================================
// ================= DATABASE CONNECT =================
// ===================================================

async function connectDatabases() {
  try {
    // ✅ AUTH DB
    await mongoose.connect(process.env.MONGO_URI_AUTH);
    console.log("✅ Auth DB connected (schoolweb)");

    // ✅ FORM DB
    const client = new MongoClient(process.env.MONGO_URI_FORM);
    await client.connect();
    app.locals.formDB = client.db("formdata");
    console.log("✅ Form DB connected (formdata)");

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));
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
  phone: String,
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
// ================= OTP + EMAIL =====================
// ===================================================

const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ===================================================
// ================= CONTACT ROUTE ===================
// ===================================================

app.post("/api/contact", async (req, res) => {
  try {
    const contact = new Contact(req.body);
    await contact.save();
    res.status(201).json({ message: "Message sent successfully" });
  } catch (err) {
    res.status(500).json({ message: "Contact failed" });
  }
});

// ===================================================
// ================= AUTH ROUTES =====================
// ===================================================

// ✅ SIGNUP WITH OTP
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: "All fields required" });

    const exists = await User.findOne({ email });
    if (exists)
      return res.status(400).json({ message: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);

    const otp = generateOTP();
    const otpExpire = new Date(Date.now() + 10 * 60 * 1000);

    await User.create({
      name,
      email,
      phone,
      password: hashed,
      otp,
      otpExpire,
      isVerified: false,
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "OTP Verification",
      text: `Your OTP is ${otp}. Valid for 10 minutes.`,
    });

    res.status(201).json({ message: "OTP sent to email" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Signup failed" });
  }
});

// ✅ VERIFY OTP
app.post("/api/auth/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "User not found" });

    if (user.otp !== otp)
      return res.status(400).json({ message: "Invalid OTP" });

    if (user.otpExpire < new Date())
      return res.status(400).json({ message: "OTP expired" });

    user.isVerified = true;
    user.otp = null;
    user.otpExpire = null;
    await user.save();

    res.json({ message: "Account verified successfully" });
  } catch (err) {
    res.status(500).json({ message: "OTP verify failed" });
  }
});

// ✅ LOGIN
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "User not found" });

    if (!user.isVerified)
      return res.status(400).json({ message: "Verify OTP first" });

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
