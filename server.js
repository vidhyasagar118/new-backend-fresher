// server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// ------------------ Models ------------------
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

const studentSchema = new mongoose.Schema({
  name: String,
  enrollmentnum: { type: String, unique: true },
  Imgsrc: String,
  votes: { type: Number, default: 0 },
});
const Student = mongoose.model("Student", studentSchema);

const voteSchema = new mongoose.Schema({
  email: String,
  enrollmentnum: String,
});
const Vote = mongoose.model("Vote", voteSchema);

const profSchema = new mongoose.Schema({
  name: String,
  role: String,
  imgsrc: String,
});
const Professor = mongoose.model("Professor", profSchema);

// ------------------ Utilities ------------------
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // e.g., kushwahaabhishekh118@gmail.com
    pass: process.env.EMAIL_PASS, // app password
  },
});

const sendOTPEmail = async (to, otp) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject: "Your OTP for Signup",
      text: `Your OTP is: ${otp}. It expires in 10 minutes.`,
    });
    console.log(`OTP sent to ${to}`);
  } catch (err) {
    console.log("Error sending OTP:", err);
  }
};

// ------------------ Auth Routes ------------------

// Signup
app.post("/api/auth/signup", async (req, res) => {
  const { name, email, phone, password } = req.body;
  try {
    if (await User.findOne({ email })) return res.status(400).json({ message: "Email exists" });
    if (await User.findOne({ phone })) return res.status(400).json({ message: "Phone exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOTP();
    const otpExpire = new Date(Date.now() + 10 * 60 * 1000);

    const newUser = new User({ name, email, phone, password: hashedPassword, otp, otpExpire });
    await newUser.save();

    await sendOTPEmail(email, otp);
    res.status(201).json({ message: "Signup successful. OTP sent." });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Verify OTP
app.post("/api/auth/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });
    if (user.otp !== otp) return res.status(400).json({ message: "Invalid OTP" });
    if (user.otpExpire < new Date()) return res.status(400).json({ message: "OTP expired" });

    user.isVerified = true;
    user.otp = null;
    user.otpExpire = null;
    await user.save();

    res.json({ message: "User verified successfully" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });
    if (!await bcrypt.compare(password, user.password)) return res.status(400).json({ message: "Invalid credentials" });
    if (!user.isVerified) return res.status(400).json({ message: "Verify OTP first" });

    const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "1d" });
    res.json({ message: "Login successful", token, user });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------ Voting Routes ------------------

// Get all students
app.get("/students", async (req, res) => {
  try {
    const students = await Student.find();
    res.json(students);
  } catch {
    res.status(500).json({ message: "Failed to fetch students" });
  }
});

// Vote
app.post("/vote", async (req, res) => {
  const { email, enrollmentnum } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || !user.isVerified) return res.status(400).json({ message: "User not verified" });

    if (await Vote.findOne({ email })) return res.status(400).json({ message: "Already voted" });

    const student = await Student.findOne({ enrollmentnum });
    if (!student) return res.status(404).json({ message: "Student not found" });

    student.votes += 1;
    await student.save();

    const vote = new Vote({ email, enrollmentnum });
    await vote.save();

    res.json({ message: "Vote successful" });
  } catch {
    res.status(500).json({ message: "Vote failed" });
  }
});

// Check vote status
app.get("/vote/status/:email", async (req, res) => {
  const vote = await Vote.findOne({ email: req.params.email });
  res.json({ hasVoted: !!vote });
});

// ------------------ Professors ------------------
app.get("/profecers", async (req, res) => {
  try {
    const profecers = await Professor.find({}, { name: 1, role: 1, imgsrc: 1 });
    res.json(profecers);
  } catch {
    res.status(500).json({ message: "Failed to fetch professors" });
  }
});

// ------------------ Top 5 Students ------------------
app.get("/students/top", async (req, res) => {
  try {
    const topStudents = await Student.find().sort({ votes: -1 }).limit(5);
    res.json(topStudents);
  } catch {
    res.status(500).json({ message: "Failed to fetch top students" });
  }
});

// ------------------ Connect & Start ------------------
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
