// server.js
import express from "express";
import { MongoClient } from "mongodb";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import nodemailer from "nodemailer";


dotenv.config();

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json()); // ⭐ VERY IMPORTANT
app.use(express.urlencoded({ extended: true }));

// ===== ES MODULE FIX =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== STATIC IMAGES =====
app.use("/images", express.static(path.join(__dirname, "images")));

// ===== DB CONFIG =====
const DB_NAME = "formdata";
const client = new MongoClient(process.env.MONGO_URL);
let db;

// ===== START SERVER =====
async function startServer() {
  try {
    await client.connect();
    db = client.db(DB_NAME);
    console.log("✅ MongoDB Connected");

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ MongoDB Error:", err);
  }
}
startServer();

// ===== TEST =====
app.get("/", (req, res) => {
  res.send("Backend is running successfully 🚀");
});

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: "All fields required" });

    const exists = await db.collection("student").findOne({ email });
    if (exists) return res.status(400).json({ message: "User already exists" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await db.collection("otpverify").deleteMany({ email });

    await db.collection("otpverify").insertOne({
      name,
      email,
      password,
      otp,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP Verification Code",
      html: `<h2>Your OTP: ${otp}</h2><p>Valid for 5 minutes</p>`,
    });

    res.status(200).json({ message: "OTP sent to email" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "OTP send failed" });
  }
});
app.post("/api/auth/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    const record = await db.collection("otpverify").findOne({ email, otp });

    if (!record) return res.status(400).json({ message: "Invalid OTP" });

    if (record.expiresAt < new Date())
      return res.status(400).json({ message: "OTP expired" });

    await db.collection("student").insertOne({
      name: record.name,
      email: record.email,
      pass: record.password,
      Imgsrc: "/images/fresher.jpg",
    });

    await db.collection("otpverify").deleteOne({ email });

    res.json({ message: "Signup successful" });
  } catch (err) {
    res.status(500).json({ message: "OTP verification failed" });
  }
});

// ✅ LOGIN
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "All fields required" });
    }

    const user = await db
      .collection("student")
      .findOne({ email, pass: password });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    res.json({
      token: "dummy-token",
      name: user.name,
      email: user.email,
      phone: user.phone,
      Imgsrc: user.Imgsrc || "/images/fresher.jpg",
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Login failed" });
  }
});

// ================= STUDENTS =================

app.get("/students", async (req, res) => {
  try {
    const students = await db.collection("votesection").find().toArray();
    res.json(students);
  } catch {
    res.status(500).json({ message: "Failed to fetch students" });
  }
});

// ================= VOTE =================

app.post("/vote", async (req, res) => {
  try {
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
  const vote = await db.collection("votes").findOne({ email: req.params.email });
  res.json({ hasVoted: !!vote });
});

// ================= PROFECERS =================

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

// ================= TOP STUDENTS =================

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
