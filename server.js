// ===== ENV SETUP =====
import dotenv from "dotenv";
dotenv.config();

// ===== IMPORTS =====
import express from "express";
import { MongoClient } from "mongodb";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";

// ===== APP =====
const app = express();
app.use(cors());
app.use(express.json());

// ===== ES MODULE __dirname FIX =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== Serve static images =====
app.use("/images", express.static(path.join(__dirname, "images")));

// ===== DB CONFIG =====
const DB_NAME = "formdata";
const MONGO_URL =
  "mongodb+srv://abhishekh:rani181149@firstclauster.9csvrwh.mongodb.net/formdata?retryWrites=true&w=majority";

const client = new MongoClient(MONGO_URL);
let db;

// ===== EMAIL CONFIG =====
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // NO SPACES
  },
});

// 🔍 VERIFY EMAIL CONFIG AT STARTUP
transporter.verify((err, success) => {
  if (err) {
    console.error("❌ Email config error:", err.message);
  } else {
    console.log("✅ Email server ready");
  }
});

// ===== TEMP OTP STORE =====
const otpStore = {};
// otpStore[email] = { otp, name, password, expires }

// ===== START SERVER =====
async function startServer() {
  try {
    await client.connect();
    db = client.db(DB_NAME);
    console.log("✅ MongoDB Atlas Connected");

    app.listen(5000, () => {
      console.log("🚀 Server running on port 5000");
    });
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
  }
}
startServer();

// ===== TEST ROUTE =====
app.get("/", (req, res) => {
  res.send("Backend is running successfully 🚀");
});

/* ================= AUTH ================= */

// ===== SEND OTP (NO DB INSERT HERE) =====
app.post("/api/auth/signup", async (req, res) => {
  if (!db) return res.status(500).json({ message: "DB not connected" });

  try {
    const { name, email, password } = req.body;

    // Check existing user
    const exists = await db.collection("student").findOne({ email });
    if (exists) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store TEMP data
    otpStore[email] = {
      otp,
      name,
      password,
      expires: Date.now() + 5 * 60 * 1000, // 5 min
    };

    console.log("🔐 OTP for", email, ":", otp);

    // Send Email
    await transporter.sendMail({
      from: `"Fresher Portal" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your Signup OTP",
      html: `
        <h2>Email Verification</h2>
        <p>Your OTP is:</p>
        <h1>${otp}</h1>
        <p>This OTP is valid for 5 minutes.</p>
      `,
    });

    console.log("✅ OTP email sent to", email);
    res.json({ message: "OTP sent to email" });
  } catch (err) {
    console.error("❌ OTP send error:", err.message);
    res.status(500).json({ message: "Failed to send OTP" });
  }
});

// ===== VERIFY OTP (DB INSERT ONLY HERE) =====
app.post("/api/auth/verify-otp", async (req, res) => {
  if (!db) return res.status(500).json({ message: "DB not connected" });

  try {
    const { email, otp } = req.body;
    const record = otpStore[email];

    if (!record) {
      return res.status(400).json({ message: "OTP not found" });
    }

    if (record.expires < Date.now()) {
      delete otpStore[email];
      return res.status(400).json({ message: "OTP expired" });
    }

    if (record.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // ✅ INSERT ONLY AFTER OTP VERIFIED
    await db.collection("student").insertOne({
      name: record.name,
      email,
      pass: record.password,
    });

    delete otpStore[email];
    console.log("✅ User registered:", email);

    res.status(201).json({ message: "Signup successful" });
  } catch (err) {
    console.error("❌ OTP verify error:", err.message);
    res.status(500).json({ message: "OTP verification failed" });
  }
});

// ===== LOGIN =====
app.post("/api/auth/login", async (req, res) => {
  if (!db) return res.status(500).json({ message: "DB not connected" });

  try {
    const { email, password } = req.body;

    const user = await db.collection("student").findOne({
      email,
      pass: password,
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    res.json({
      token: "dummy-token",
      email: user.email,
      name: user.name,
      enrollmentnum: user.enrollmentnum || null,
      Imgsrc: user.Imgsrc || "/images/fresher.jpg",
    });
  } catch {
    res.status(500).json({ message: "Login failed" });
  }
});

/* ===== बाकी ROUTES (UNCHANGED) ===== */

app.get("/students", async (req, res) => {
  const students = await db.collection("votesection").find().toArray();
  res.json(students);
});

app.post("/vote", async (req, res) => {
  const { email, enrollmentnum } = req.body;
  const voted = await db.collection("votes").findOne({ email });
  if (voted) return res.status(400).json({ message: "Already voted" });

  await db.collection("votes").insertOne({ email, enrollmentnum });
  await db.collection("votesection").updateOne(
    { enrollmentnum },
    { $inc: { votes: 1 } }
  );
  res.json({ message: "Vote successful" });
});

app.get("/vote/status/:email", async (req, res) => {
  const vote = await db.collection("votes").findOne({ email: req.params.email });
  res.json({ hasVoted: !!vote });
});

let profecerCache = null;

app.get("/profecers", async (req, res) => {
  if (profecerCache) return res.json(profecerCache);

  const profecers = await db
    .collection("profecerinfo")
    .find({}, { projection: { name: 1, role: 1, imgsrc: 1 } })
    .toArray();

  profecerCache = profecers;
  res.json(profecers);
});

app.get("/students/top", async (req, res) => {
  const topStudents = await db
    .collection("votesection")
    .find()
    .sort({ votes: -1 })
    .limit(1)
    .toArray();

  res.json(topStudents);
});
