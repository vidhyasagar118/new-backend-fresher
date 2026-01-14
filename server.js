// server.js
import express from "express";
import { MongoClient } from "mongodb";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
<<<<<<< HEAD
app.use(cors());
app.use(express.json());

// ===== ES MODULE __dirname FIX =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== Serve static images =====
app.use("/images", express.static(path.join(__dirname, "images")));

// ===== DB CONFIG =====
const DB_NAME = "formdata";
const url =
  "mongodb+srv://abhishekh:rani181149@firstclauster.9csvrwh.mongodb.net/formdata?retryWrites=true&w=majority";

const client = new MongoClient(url);
let db;

=======

/* ===== MIDDLEWARE ===== */
app.use(cors());
app.use(express.json());

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
>>>>>>> d5c32726d69587d25d707fc5c5d6bb3c732c543f
async function startServer() {
  try {
    await client.connect();
    db = client.db(DB_NAME);
<<<<<<< HEAD
    console.log("✅ MongoDB Atlas Connected");

    app.listen(5000, () => {
      console.log("🚀 Server running on port 5000");
    });
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
  }
}
startServer();
=======
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
>>>>>>> d5c32726d69587d25d707fc5c5d6bb3c732c543f
app.get("/", (req, res) => {
  res.send("Backend is running successfully 🚀");
});

<<<<<<< HEAD
// ===== AUTH =====
app.post("/api/auth/signup", async (req, res) => {
  if (!db) return res.status(500).json({ message: "DB not connected" });

  try {
    const { name, email, password } = req.body;

    const exists = await db.collection("student").findOne({ email });
    if (exists) return res.status(400).json({ message: "User already exists" });

    await db.collection("student").insertOne({ name, email, pass: password });
    res.status(201).json({ message: "Signup successful" });
  } catch (err) {
=======
/* ===== SIGNUP ===== */
app.post("/api/auth/signup", async (req, res) => {
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
    console.error("Signup error:", err);
>>>>>>> d5c32726d69587d25d707fc5c5d6bb3c732c543f
    res.status(500).json({ message: "Signup failed" });
  }
});

<<<<<<< HEAD
app.post("/api/auth/login", async (req, res) => {
  if (!db) return res.status(500).json({ message: "DB not connected" });

  try {
    const { email, password } = req.body;
    const user = await db.collection("student").findOne({ email, pass: password });

    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    res.json({
      token: "dummy-token",
      email: user.email,
      name: user.name,
      enrollmentnum: user.enrollmentnum || null,
      Imgsrc: user.Imgsrc || "/images/fresher.jpg", // fallback image
    });
  } catch {
=======
/* ===== LOGIN ===== */
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
      enrollmentnum: user.enrollmentnum || null,
      Imgsrc: user.Imgsrc || "/images/fresher.jpg",
    });
  } catch (err) {
    console.error("Login error:", err);
>>>>>>> d5c32726d69587d25d707fc5c5d6bb3c732c543f
    res.status(500).json({ message: "Login failed" });
  }
});

<<<<<<< HEAD
// ===== STUDENTS (VOTE SECTION) =====
app.get("/students", async (req, res) => {
  if (!db) return res.status(500).json({ message: "DB not connected" });
=======
/* ===== STUDENTS ===== */
app.get("/students", async (req, res) => {
>>>>>>> d5c32726d69587d25d707fc5c5d6bb3c732c543f
  try {
    const students = await db.collection("votesection").find().toArray();
    res.json(students);
  } catch {
    res.status(500).json({ message: "Failed to fetch students" });
  }
});

<<<<<<< HEAD
// ===== VOTE =====
app.post("/vote", async (req, res) => {
  if (!db) return res.status(500).json({ message: "DB not connected" });

  try {
    const { email, enrollmentnum } = req.body;
=======
/* ===== VOTE ===== */
app.post("/vote", async (req, res) => {
  try {
    const { email, enrollmentnum } = req.body;

>>>>>>> d5c32726d69587d25d707fc5c5d6bb3c732c543f
    const voted = await db.collection("votes").findOne({ email });
    if (voted) return res.status(400).json({ message: "Already voted" });

    await db.collection("votes").insertOne({ email, enrollmentnum });
    await db.collection("votesection").updateOne(
      { enrollmentnum },
      { $inc: { votes: 1 } }
    );
<<<<<<< HEAD
=======

>>>>>>> d5c32726d69587d25d707fc5c5d6bb3c732c543f
    res.json({ message: "Vote successful" });
  } catch {
    res.status(500).json({ message: "Vote failed" });
  }
});

app.get("/vote/status/:email", async (req, res) => {
<<<<<<< HEAD
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
=======
  const vote = await db.collection("votes").findOne({ email: req.params.email });
  res.json({ hasVoted: !!vote });
});

/* ===== PROFECERS ===== */
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
>>>>>>> d5c32726d69587d25d707fc5c5d6bb3c732c543f
    res.status(500).json({ message: "Failed to fetch profecers" });
  }
});

<<<<<<< HEAD

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
=======
/* ===== TOP STUDENTS ===== */
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
>>>>>>> d5c32726d69587d25d707fc5c5d6bb3c732c543f
