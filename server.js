
import express from "express";
import { MongoClient } from "mongodb";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();

/* ===== MIDDLEWARE ===== */
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ===== ES MODULE FIX ===== */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ===== STATIC IMAGES ===== */
app.use("/images", express.static(path.join(__dirname, "images")));

/* ===== DB CONFIG ===== */
const DB_NAME = "formdata";
const client = new MongoClient(process.env.MONGO_URL);
let db;

/* ===== START SERVER ===== */
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

/* ===== TEST ROUTE ===== */
app.get("/", (req, res) => {
  res.send("Backend is running successfully 🚀");
});

/* ================= AUTH ================= */

/* ===== SIGNUP ===== */
app.post("/api/auth/signup", async (req, res) => {
  console.log("Signup body:", req.body);

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
    });

    res.status(201).json({ message: "Signup successful" });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: "Signup failed" });
  }
});

/* ===== LOGIN ===== */
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

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
      enrollmentnum: user.enrollmentnum || null,
      Imgsrc: user.Imgsrc || "/images/fresher.jpg",
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Login failed" });
  }
});

// ===== STUDENTS (VOTE SECTION) =====
app.get("/students", async (req, res) => {
  if (!db) return res.status(500).json({ message: "DB not connected" });
  try {
    const students = await db.collection("votesection").find().toArray();
    res.json(students);
  } catch {
    res.status(500).json({ message: "Failed to fetch students" });
  }
});

// ===== VOTE =====
app.post("/vote", async (req, res) => {
  if (!db) return res.status(500).json({ message: "DB not connected" });

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
  if (!db) return res.status(500).json({ message: "DB not connected" });

  const vote = await db.collection("votes").findOne({ email: req.params.email });
  res.json({ hasVoted: !!vote });
});
let profecerCache = null;   

app.get("/profecers", async (req, res) => {
  if (!db) return res.status(500).json({ message: "DB not connected" });

  try {
    if (profecerCache) {
      return res.json(profecerCache);  
    }

    const profecers = await db .collection("profecerinfo") .find({}, { projection: { name: 1, role: 1, imgsrc: 1 } }) .toArray();
    profecerCache = profecers;
    res.json(profecers);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch profecers" });
  }
});


// ===== TOP 5 MOST VOTED STUDENTS (FROM VOTESECTION) =====
app.get("/students/top", async (req, res) => {
  if (!db) return res.status(500).json({ message: "DB not connected" });

  try {
    const topStudents = await db
      .collection("votesection")   // ✅ SAME AS VOTESECTION
      .find()
      .sort({ votes: -1 })         // highest votes first
      .limit(1)
      .toArray();

    res.json(topStudents);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch top students" });
  }
});