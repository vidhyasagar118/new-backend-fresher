import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use("/images", express.static(path.join(__dirname, "images")));

const client = new MongoClient(process.env.MONGO_URL);
let db;

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// ✅ Gmail transporter (use App Password!)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

const sendOTPEmail = async (to, otp) => {
  const mailOptions = {
    from: process.env.GMAIL_USER,
    to,
    subject: "Your OTP for Signup",
    text: `Your OTP is: ${otp}. It will expire in 10 minutes.`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ OTP sent to ${to}`);
  } catch (err) {
    console.error("❌ Error sending OTP email:", err);
    throw err;
  }
};

// Start server and connect to MongoDB
async function startServer() {
  try {
    await client.connect();
    db = client.db("formdata");
    console.log("✅ MongoDB Connected");

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  } catch (err) {
    console.error("❌ MongoDB Error:", err);
  }
}

startServer();

// ===== TEST ROUTE =====
app.get("/", (req, res) => res.send("Backend is running successfully 🚀"));

// ===== SIGNUP =====
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: "All fields required" });
    }

    const existsEmail = await db.collection("student").findOne({ email });
    if (existsEmail) return res.status(400).json({ message: "Email already exists" });

    const existsPhone = await db.collection("student").findOne({ phone });
    if (existsPhone) return res.status(400).json({ message: "Phone already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOTP();
    const otpExpire = new Date(Date.now() + 10 * 60 * 1000);

    await sendOTPEmail(email, otp);

    await db.collection("student").insertOne({
      name,
      email,
      phone,
      pass: hashedPassword,
      otp,
      otpExpire,
      isVerified: false,
      votes: 0,
      Imgsrc: "/images/fresher.jpg",
    });

    res.status(201).json({ message: "Signup successful. OTP sent to your email." });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: "Signup failed. OTP may not have sent." });
  }
});

// ===== VERIFY OTP =====
app.post("/api/auth/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await db.collection("student").findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });
    if (user.otp !== otp) return res.status(400).json({ message: "Invalid OTP" });
    if (new Date(user.otpExpire) < new Date()) return res.status(400).json({ message: "OTP expired" });

    await db.collection("student").updateOne(
      { email },
      { $set: { isVerified: true }, $unset: { otp: "", otpExpire: "" } }
    );

    res.json({ message: "User verified successfully" });
  } catch (err) {
    console.error("OTP verification error:", err);
    res.status(500).json({ message: "Verification failed" });
  }
});

// ===== LOGIN =====
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await db.collection("student").findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.pass);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    if (!user.isVerified) return res.status(400).json({ message: "User not verified. Please verify OTP first." });

    const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "1d" });

    res.json({
      message: "Login successful",
      token,
      name: user.name,
      email: user.email,
      enrollmentnum: user.enrollmentnum || null,
      Imgsrc: user.Imgsrc || "/images/fresher.jpg",
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Login failed" });
  }
});

// ===== VOTING =====
app.get("/students", async (req, res) => {
  try {
    const students = await db.collection("votesection").find().toArray();
    res.json(students);
  } catch {
    res.status(500).json({ message: "Failed to fetch students" });
  }
});

app.post("/vote", async (req, res) => {
  try {
    const { email, enrollmentnum } = req.body;
    const user = await db.collection("student").findOne({ email });
    if (!user || !user.isVerified) return res.status(400).json({ message: "User not verified" });

    const voted = await db.collection("votes").findOne({ email });
    if (voted) return res.status(400).json({ message: "Already voted" });

    await db.collection("votes").insertOne({ email, enrollmentnum });
    await db.collection("votesection").updateOne({ enrollmentnum }, { $inc: { votes: 1 } });

    res.json({ message: "Vote successful" });
  } catch {
    res.status(500).json({ message: "Vote failed" });
  }
});

app.get("/vote/status/:email", async (req, res) => {
  const vote = await db.collection("votes").findOne({ email: req.params.email });
  res.json({ hasVoted: !!vote });
});

// ===== PROFECERS =====
let profecerCache = null;
app.get("/profecers", async (req, res) => {
  try {
    if (profecerCache) return res.json(profecerCache);

    const profecers = await db
      .collection("profecerinfo")
      .find({}, { projection: { name: 1, role: 1, imgsrc: 1 } })
      .toArray();

    profecerCache = profecers;
    res.json(profecers);
  } catch {
    res.status(500).json({ message: "Failed to fetch profecers" });
  }
});

// ===== TOP 5 MOST VOTED STUDENTS =====
app.get("/students/top", async (req, res) => {
  try {
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
