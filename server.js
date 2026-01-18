import express from "express";
import { MongoClient } from "mongodb";
import cors from "cors";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
app.use(cors({
  origin: ["https://freshers1.vercel.app"],
  methods: ["GET", "POST"],
  credentials: false,
}));
app.options("*", cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use("/images", express.static(path.join(__dirname, "images")));

const client = new MongoClient(process.env.MONGO_URL);
let db;

const otpStore = new Map();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, 
  },
});

async function start() {
  try {
    await client.connect();
    db = client.db("formdata");
    console.log("✅ MongoDB Connected");

    app.listen(process.env.PORT || 5000, () =>
      console.log("🚀 Server Running on Port", process.env.PORT || 5000)
    );
  } catch (err) {
    console.error("❌ DB Connection Error:", err);
  }
}
start();

app.get("/", (req, res) => res.send("Backend Running 🚀"));


app.post("/api/auth/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(email, otp);

    console.log("OTP:", otp, "Email:", email);

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your Signup OTP",
      html: `<h2>Your OTP is: ${otp}</h2>`,
    });

    res.json({ message: "OTP sent successfully" });
  } catch (err) {
    console.error("❌ OTP Email Error:", err);
    res.status(500).json({ message: "OTP send failed" });
  }
});

// ===== VERIFY OTP + SIGNUP =====
app.post("/api/auth/verify-signup", async (req, res) => {
  try {
    const { name, email, password, enrollmentnum, otp } = req.body;

    if (!otpStore.has(email))
      return res.status(400).json({ message: "OTP expired" });

    if (otpStore.get(email) !== otp)
      return res.status(400).json({ message: "Invalid OTP" });

    const exists = await db.collection("freshersignupdata").findOne({ email });
    if (exists) return res.status(400).json({ message: "User already exists" });

    await db.collection("freshersignupdata").insertOne({
      name,
      email,
      pass: password,
      enrollmentnum,
      Imgsrc: "/images/fresher.jpg",
    });

    otpStore.delete(email);
    res.status(201).json({ message: "Signup successful" });
  } catch (err) {
    console.error("❌ Signup Error:", err);
    res.status(500).json({ message: "Signup failed" });
  }
});

// ===== LOGIN =====
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await db
      .collection("freshersignupdata")
      .findOne({ email, pass: password });

    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    res.json({
      name: user.name,
      email: user.email,
      enrollmentnum: user.enrollmentnum,
      Imgsrc: user.Imgsrc,
    });
  } catch (err) {
    console.error("❌ Login Error:", err);
    res.status(500).json({ message: "Login failed" });
  }
});

/* =====================================================
   STUDENTS + VOTING
===================================================== */

// ===== ALL STUDENTS =====
app.get("/students", async (req, res) => {
  try {
    const students = await db.collection("votesection").find().toArray();
    res.json(students);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch students" });
  }
});

// ===== VOTE =====
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Vote failed" });
  }
});

// ===== CHECK VOTE =====
app.get("/vote/status/:email", async (req, res) => {
  try {
    const vote = await db.collection("votes").findOne({ email: req.params.email });
    res.json({ hasVoted: !!vote });
  } catch {
    res.status(500).json({ hasVoted: false });
  }
});

// ===== TOP STUDENTS =====
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

/* =====================================================
   PROFECERS
===================================================== */

let profecerCache = null;

app.get("/profecers", async (req, res) => {
  try {
    if (profecerCache) return res.json(profecerCache);

    const profecers = await db
      .collection("profecerinfo")
      .find({}, { projection: { name: 1, role: 1 } })
      .toArray();

    profecerCache = profecers;
    res.json(profecers);
  } catch {
    res.status(500).json({ message: "Failed to fetch profecers" });
  }
});
