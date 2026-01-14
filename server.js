// server.js
import express from "express";
import { MongoClient } from "mongodb";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

import sgMail from "@sendgrid/mail";
import { v4 as uuid } from "uuid";

dotenv.config();

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json()); // ⭐ VERY IMPORTANT
app.use(express.urlencoded({ extended: true }));

sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const otpCollection = () => db.collection("otp_requests");

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

// ================= AUTH =================
app.post("/api/auth/signup", async (req, res) => {
  console.log("SIGNUP BODY 👉", req.body); // 👈 ADD THIS

  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields required" });
    }

    const exists = await db.collection("student").findOne({ email });
    if (exists) {
      return res.status(400).json({ message: "User already exists" });
    }

    await db.collection("student").insertOne({
      name,
      email,
      pass: password,
      Imgsrc: "/images/fresher.jpg",
    });

    res.status(201).json({ message: "Signup successful" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Signup failed" });
  }
});

app.post("/api/auth/send-otp", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password)
    return res.status(400).json({ message: "All fields required" });

  const exists = await db.collection("student").findOne({ email });
  if (exists) return res.status(400).json({ message: "User already exists" });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  await otpCollection().deleteMany({ email });

  await otpCollection().insertOne({
    email,
    name,
    password,
    otp,
    createdAt: new Date(),
  });

  await sgMail.send({
    to: email,
    from: "YOUR_VERIFIED_EMAIL",
    subject: "Your Signup OTP",
    text: `Your OTP is ${otp}`,
  });

  res.json({ message: "OTP sent" });
});
app.post("/api/auth/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  const record = await otpCollection().findOne({ email, otp });
  if (!record) return res.status(400).json({ message: "Invalid OTP" });

  await db.collection("student").insertOne({
    name: record.name,
    email: record.email,
    pass: record.password,
    Imgsrc: "/images/fresher.jpg",
  });

  await otpCollection().deleteOne({ email });

  res.json({ message: "Signup complete" });
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