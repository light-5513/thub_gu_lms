"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { pipeline } = require("node:stream/promises");
const express = require("express");
const dotenv = require("dotenv");
const QRCode = require("qrcode");
const { MongoClient, GridFSBucket, ObjectId } = require("mongodb");
const { Client, RemoteAuth } = require("whatsapp-web.js");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const port = Number(process.env.PORT || 10000);
const apiToken = process.env.WHATSAPP_API_TOKEN || "";
const outboxSecret = process.env.WHATSAPP_OUTBOX_KEY || "";
const dataPath = process.env.WHATSAPP_DATA_PATH || "/tmp/wwebjs_auth";
const sessionName = process.env.WHATSAPP_SESSION_NAME || "lms-invitations";
const backupSyncIntervalMs = Number(process.env.WHATSAPP_BACKUP_INTERVAL_MS || 300000);
const sendIntervalMs = Number(process.env.WHATSAPP_SEND_INTERVAL_MS || 2000);
const mongoUri = process.env.WHATSAPP_MONGODB_URI || process.env.MONGODB_URI || "";
const databaseName = process.env.MONGODB_DATABASE || "lms";

let state = "starting";
let qrDataUrl = null;
let lastError = null;
let sessionSaved = false;
let sessionBackupError = null;
let client;
let mongo;
let outbox;
let invitations;
let outboxWorker;
let shuttingDown = false;

function requireConfig() {
  const missing = [];
  if (!apiToken) missing.push("WHATSAPP_API_TOKEN");
  if (!outboxSecret) missing.push("WHATSAPP_OUTBOX_KEY");
  if (!mongoUri) missing.push("MONGODB_URI");
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  if (!/^[-_\w]+$/.test(sessionName)) {
    throw new Error("WHATSAPP_SESSION_NAME may contain only letters, numbers, underscores, and hyphens");
  }
}

function encryptionKey() {
  return crypto.createHash("sha256").update(outboxSecret).digest();
}

function encryptMessage(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return {
    text_ciphertext: ciphertext.toString("base64"),
    text_iv: iv.toString("base64"),
    text_tag: cipher.getAuthTag().toString("base64"),
  };
}

function decryptMessage(job) {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(job.text_iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(job.text_tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(job.text_ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class ResilientClient extends Client {
  async inject() {
    if (this.safeInjectPromise) return this.safeInjectPromise;
    this.safeInjectPromise = (async () => {
      let lastError;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        try {
          return await super.inject();
        } catch (error) {
          const message = String(error?.message || error);
          const navigationRace = /Execution context was destroyed|Cannot find context|detached Frame/i.test(message);
          if (!navigationRace || attempt === 5 || shuttingDown) throw error;
          lastError = error;
          await delay(250 * (attempt + 1));
        }
      }
      throw lastError;
    })();
    try {
      return await this.safeInjectPromise;
    } finally {
      this.safeInjectPromise = null;
    }
  }
}

async function updateInvitationStatus(job, status, error = null) {
  if (!job.invitation_id || !ObjectId.isValid(job.invitation_id)) return;
  const update = {
    whatsapp_status: status,
    whatsapp_updated_at: new Date(),
  };
  if (status === "sent") update.whatsapp_sent_at = new Date();
  if (error) update.whatsapp_error = String(error).slice(0, 300);
  else update.whatsapp_error = null;
  try {
    await invitations.updateOne(
      { _id: new ObjectId(job.invitation_id) },
      { $set: update },
    );
  } catch (updateError) {
    console.error("Could not update invitation delivery status:", updateError.message);
  }
}

async function sendOneQueuedMessage() {
  const job = await outbox.findOneAndUpdate(
    { status: "queued" },
    { $set: { status: "sending", started_at: new Date() } },
    { sort: { created_at: 1 }, returnDocument: "after", includeResultMetadata: false },
  );
  if (!job) return false;

  try {
    if (job.invitation_id) {
      const invitationIsActive = await invitations.findOne({
        _id: new ObjectId(job.invitation_id),
        used: false,
        expires_at: { $gt: new Date() },
      }, { projection: { _id: 1 } });
      if (!invitationIsActive) {
        throw new Error("Invitation is no longer active");
      }
    }
    if (job.expires_at && new Date(job.expires_at) <= new Date()) {
      throw new Error("Invitation link expired before the message could be sent");
    }
    const numberId = await client.getNumberId(job.phone);
    if (!numberId) throw new Error("This number is not registered on WhatsApp");
    await client.sendMessage(numberId._serialized, decryptMessage(job));
    await outbox.updateOne(
      { _id: job._id },
      { $set: { status: "sent", sent_at: new Date() }, $unset: { text_ciphertext: "", text_iv: "", text_tag: "" } },
    );
    await updateInvitationStatus(job, "sent");
  } catch (error) {
    const message = String(error?.message || "WhatsApp send failed").slice(0, 300);
    console.error("WhatsApp delivery failed for a queued message:", message);
    await outbox.updateOne(
      { _id: job._id },
      { $set: { status: "failed", failed_at: new Date(), error: message }, $unset: { text_ciphertext: "", text_iv: "", text_tag: "" } },
    );
    await updateInvitationStatus(job, "failed", message);
  }
  return true;
}

async function runOutbox() {
  while (!shuttingDown) {
    if (state !== "ready") {
      await delay(2000);
      continue;
    }
    try {
      const processed = await sendOneQueuedMessage();
      await delay(processed ? sendIntervalMs : 1500);
    } catch (error) {
      console.error("WhatsApp outbox worker error:", error.message);
      await delay(5000);
    }
  }
}

async function initializeWhatsAppClient() {
  let attempt = 0;
  while (!shuttingDown) {
    try {
      state = "starting";
      await client.initialize();
      return;
    } catch (error) {
      attempt += 1;
      state = "error";
      lastError = String(error?.message || "WhatsApp initialization failed").slice(0, 300);
      console.error("WhatsApp initialization failed; retrying:", lastError);
      try {
        await client.destroy();
      } catch (destroyError) {
        console.warn("WhatsApp cleanup before retry failed:", destroyError.message);
      }
      if (!shuttingDown) {
        await delay(Math.min(attempt * 5000, 30000));
      }
    }
  }
}

function safeEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function authenticate(req, res, next) {
  const authorization = req.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token || !safeEqual(token, apiToken)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

class MongoSessionStore {
  constructor(bucket, collection, root) {
    this.bucket = bucket;
    this.files = collection;
    this.root = root;
  }

  async sessionExists({ session }) {
    const exists = Boolean(await this.files.findOne({ filename: `${session}.zip` }, { projection: { _id: 1 } }));
    if (exists) sessionSaved = true;
    return exists;
  }

  async save({ session }) {
    const zipPath = path.join(this.root, `${session}.zip`);
    const oldFiles = await this.files.find({ filename: `${session}.zip` }).toArray();
    const upload = this.bucket.openUploadStream(`${session}.zip`, {
      metadata: { session, savedAt: new Date() },
    });
    await pipeline(fs.createReadStream(zipPath), upload);
    await Promise.all(oldFiles.map((file) => this.bucket.delete(file._id).catch(() => {})));
  }

  async extract({ session, path: destination }) {
    const file = await this.files.find({ filename: `${session}.zip` }).sort({ uploadDate: -1 }).limit(1).next();
    if (!file) throw new Error("WhatsApp session archive was not found");
    await fs.promises.mkdir(path.dirname(destination), { recursive: true });
    await pipeline(this.bucket.openDownloadStream(file._id), fs.createWriteStream(destination));
  }

  async delete({ session }) {
    const files = await this.files.find({ filename: `${session}.zip` }).toArray();
    await Promise.all(files.map((file) => this.bucket.delete(file._id).catch(() => {})));
  }
}

class ResilientRemoteAuth extends RemoteAuth {
  constructor(options) {
    super(options);
    this.backupPromise = null;
    this.retryTimer = null;
  }

  async storeRemoteSession(options) {
    if (this.backupPromise) return this.backupPromise;
    const backup = (async () => {
      try {
        await super.storeRemoteSession(options);
        sessionSaved = true;
        sessionBackupError = null;
        if (this.retryTimer) clearTimeout(this.retryTimer);
        this.retryTimer = null;
      } catch (error) {
        sessionBackupError = String(error?.message || "Session backup failed").slice(0, 300);
        console.error("WhatsApp session backup failed; the connection will stay active and backup will retry:", sessionBackupError);
        if (!this.retryTimer && !shuttingDown) {
          this.retryTimer = setTimeout(() => {
            this.retryTimer = null;
            void this.storeRemoteSession().catch((retryError) => {
              console.error("WhatsApp session backup retry failed:", retryError.message);
            });
          }, 10000);
          this.retryTimer.unref?.();
        }
      }
    })();
    this.backupPromise = backup;
    try {
      return await backup;
    } finally {
      if (this.backupPromise === backup) this.backupPromise = null;
    }
  }

  async destroy() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.backupPromise) await this.backupPromise;
    await super.destroy();
  }
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!/^\d{8,15}$/.test(digits)) {
    throw new Error("Use an international WhatsApp number with country code, such as +919876543210");
  }
  return digits;
}

async function main() {
  requireConfig();
  await fs.promises.mkdir(dataPath, { recursive: true });

  mongo = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 15000 });
  await mongo.connect();
  const db = mongo.db(databaseName);
  const bucketName = "whatsapp_sessions";
  outbox = db.collection("whatsapp_outbox");
  invitations = db.collection("invitations");
  await outbox.createIndex({ status: 1, created_at: 1 });
  await outbox.updateMany({ status: "sending" }, { $set: { status: "queued" } });
  const bucket = new GridFSBucket(db, { bucketName });
  const store = new MongoSessionStore(bucket, db.collection(`${bucketName}.files`), dataPath);

  client = new ResilientClient({
    authStrategy: new ResilientRemoteAuth({
      clientId: sessionName,
      dataPath,
      store,
      backupSyncIntervalMs,
    }),
    puppeteer: {
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    },
  });

  client.on("qr", async (qr) => {
    try {
      qrDataUrl = await QRCode.toDataURL(qr, { margin: 2, width: 300 });
      state = "qr_required";
      lastError = null;
      console.log("WhatsApp needs pairing: scan the QR code in the LMS Invitations page.");
    } catch (error) {
      state = "error";
      lastError = error.message;
      console.error("Could not render WhatsApp QR code:", error.message);
    }
  });
  client.on("authenticated", () => {
    state = "authenticated";
    qrDataUrl = null;
    lastError = null;
    console.log("WhatsApp account authenticated.");
  });
  client.on("ready", () => {
    state = "ready";
    qrDataUrl = null;
    lastError = null;
    console.log("WhatsApp client is ready.");
    void client.authStrategy.storeRemoteSession({ emit: true });
    if (!outboxWorker) {
      outboxWorker = runOutbox().catch((error) => {
        console.error("WhatsApp outbox worker stopped unexpectedly:", error);
      });
    }
  });
  client.on("remote_session_saved", () => {
    sessionSaved = true;
    sessionBackupError = null;
    console.log("WhatsApp session backup saved to MongoDB.");
  });
  client.on("auth_failure", (message) => {
    state = "auth_failure";
    lastError = String(message || "WhatsApp authentication failed").slice(0, 300);
    sessionSaved = false;
    console.error("WhatsApp authentication failed:", lastError);
  });
  client.on("disconnected", (reason) => {
    state = "disconnected";
    lastError = String(reason || "WhatsApp disconnected").slice(0, 300);
    sessionSaved = false;
    console.warn("WhatsApp disconnected:", lastError);
  });

  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "16kb" }));
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.get("/status", authenticate, (_req, res) => {
    res.json({
      state,
      qr_data_url: qrDataUrl,
      session_saved: sessionSaved,
      session_error: sessionBackupError,
      error: lastError,
    });
  });
  app.post("/send", authenticate, async (req, res) => {
    if (state !== "ready") {
      return res.status(503).json({ error: "WhatsApp is not connected yet", state });
    }
    const { phone, text, invitation_id: invitationId, expires_at: expiresAtRaw } = req.body || {};
    if (typeof text !== "string" || text.trim().length === 0 || text.length > 5000) {
      return res.status(400).json({ error: "Message text must be between 1 and 5000 characters" });
    }
    let digits;
    try {
      digits = normalizePhone(phone);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    try {
      const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;
      if (expiresAtRaw && Number.isNaN(expiresAt.getTime())) {
        return res.status(400).json({ error: "Invalid invitation expiry date" });
      }
      const encrypted = encryptMessage(text.trim());
      const result = await outbox.insertOne({
        phone: digits,
        ...encrypted,
        invitation_id: invitationId || null,
        expires_at: expiresAt,
        status: "queued",
        created_at: new Date(),
      });
      return res.status(202).json({ ok: true, job_id: result.insertedId.toString(), status: "queued" });
    } catch (error) {
      console.error("WhatsApp message could not be queued:", error.message);
      return res.status(503).json({ error: "WhatsApp message could not be queued" });
    }
  });

  app.listen(port, "0.0.0.0", () => console.log(`Private WhatsApp API listening on ${port}`));
  await initializeWhatsAppClient();
}

main().catch((error) => {
  state = "error";
  lastError = error.message;
  console.error("WhatsApp API failed to start:", error);
  process.exit(1);
});

async function shutdown() {
  shuttingDown = true;
  try {
    if (client?.authStrategy) await client.authStrategy.destroy();
    if (client) await client.destroy();
  } catch (error) {
    console.warn("WhatsApp shutdown warning:", error.message);
  }
  try {
    if (mongo) await mongo.close();
  } catch (error) {
    console.warn("MongoDB shutdown warning:", error.message);
  }
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
