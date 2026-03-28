import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("scout.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT UNIQUE,
    name TEXT,
    is_subscribed INTEGER DEFAULT 0,
    last_checked DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS opportunities (
    id TEXT PRIMARY KEY,
    title TEXT,
    source TEXT,
    budget TEXT,
    deadline TEXT,
    description TEXT,
    tags TEXT,
    status TEXT,
    url TEXT,
    matchScore INTEGER,
    aiSummary TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Cleanup old opportunities and inactive sources
  const cleanupData = () => {
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    // Delete opportunities older than 7 days OR past their deadline
    db.prepare("DELETE FROM opportunities WHERE created_at < ? OR (deadline < ? AND deadline != '')").run(sevenDaysAgo, today);
    
    // Delete sources that are NOT subscribed and were created more than 7 days ago
    db.prepare("DELETE FROM sources WHERE is_subscribed = 0 AND created_at < ?").run(sevenDaysAgo);
  };

  // Run cleanup on startup
  cleanupData();

  // API to trigger manual sync/cleanup
  app.post("/api/system/sync", (req, res) => {
    cleanupData();
    res.json({ success: true, message: "System synchronized. Old data cleared." });
  });

  // Sources API
  app.get("/api/sources", (req, res) => {
    const sources = db.prepare("SELECT * FROM sources ORDER BY created_at DESC").all();
    res.json(sources);
  });

  app.post("/api/sources", (req, res) => {
    const { url, name } = req.body;
    try {
      // Check if we already have 10 subscribed sources if this were to be subscribed
      // But here we just add the source. Subscription is a separate toggle.
      const info = db.prepare("INSERT INTO sources (url, name) VALUES (?, ?)").run(url, name || new URL(url).hostname);
      res.json({ id: info.lastInsertRowid, url, name });
    } catch (err) {
      // If exists, just return the existing one
      const existing = db.prepare("SELECT * FROM sources WHERE url = ?").get(url);
      if (existing) {
        res.json(existing);
      } else {
        res.status(400).json({ error: "Invalid URL" });
      }
    }
  });

  app.patch("/api/sources/:id", (req, res) => {
    const { is_subscribed } = req.body;
    
    if (is_subscribed) {
      const subscribedCount = db.prepare("SELECT COUNT(*) as count FROM sources WHERE is_subscribed = 1").get().count;
      if (subscribedCount >= 10) {
        return res.status(400).json({ error: "Maximum of 10 subscribed sources allowed." });
      }
    }

    db.prepare("UPDATE sources SET is_subscribed = ?, last_checked = CURRENT_TIMESTAMP WHERE id = ?").run(is_subscribed ? 1 : 0, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/sources/:id", (req, res) => {
    db.prepare("DELETE FROM sources WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Opportunities API
  app.get("/api/opportunities", (req, res) => {
    const opps = db.prepare("SELECT * FROM opportunities ORDER BY created_at DESC").all();
    // Parse tags back into array
    const parsedOpps = opps.map(o => ({
      ...o,
      tags: o.tags ? JSON.parse(o.tags) : []
    }));
    res.json(parsedOpps);
  });

  app.post("/api/opportunities", (req, res) => {
    const opp = req.body;
    try {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO opportunities (id, title, source, budget, deadline, description, tags, status, url, matchScore, aiSummary)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        opp.id,
        opp.title,
        opp.source,
        opp.budget,
        opp.deadline,
        opp.description,
        JSON.stringify(opp.tags || []),
        opp.status || 'open',
        opp.url,
        opp.matchScore,
        opp.aiSummary
      );
      res.json({ success: true });
    } catch (err) {
      console.error("Failed to save opportunity", err);
      res.status(500).json({ error: "Failed to save opportunity" });
    }
  });

  app.patch("/api/opportunities/:id", (req, res) => {
    const { matchScore, aiSummary, status } = req.body;
    try {
      db.prepare("UPDATE opportunities SET matchScore = ?, aiSummary = ?, status = ? WHERE id = ?")
        .run(matchScore, aiSummary, status, req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Update failed" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
