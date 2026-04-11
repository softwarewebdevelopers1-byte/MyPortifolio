import path from "path";
import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import { Project } from "./models/Project";

dotenv.config();

const PORT = process.env.PORT || "4000";
const MONGODB_URI = process.env.MONGODB_URI;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET;
const OWNER_PASSWORD = process.env.OWNER_PASSWORD;
const OWNER_SESSION_SECRET =
  process.env.OWNER_SESSION_SECRET || process.env.OWNER_PASSWORD;
const OWNER_TOKEN_TTL_MS = 1000 * 60 * 60 * 12;

if (
  !MONGODB_URI ||
  !SUPABASE_URL ||
  !SUPABASE_SERVICE_ROLE_KEY ||
  !SUPABASE_BUCKET ||
  !OWNER_PASSWORD ||
  !OWNER_SESSION_SECRET
) {
  throw new Error("Missing environment variables.");
}

const mongoUri = MONGODB_URI;
const supabaseUrl = SUPABASE_URL;
const supabaseServiceRoleKey = SUPABASE_SERVICE_ROLE_KEY;
const supabaseBucket = SUPABASE_BUCKET;
const ownerPassword = OWNER_PASSWORD;
const ownerSessionSecret = OWNER_SESSION_SECRET;

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_request, file, callback) => {
    if (!file.mimetype.startsWith("image/")) {
      callback(new Error("Only image uploads are allowed."));
      return;
    }

    callback(null, true);
  },
});

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

type AsyncHandler = (
  request: Request,
  response: Response,
  next: NextFunction,
) => Promise<void>;

function asyncHandler(handler: AsyncHandler) {
  return (request: Request, response: Response, next: NextFunction) => {
    handler(request, response, next).catch(next);
  };
}

function signTokenPayload(payload: string) {
  return createHmac("sha256", ownerSessionSecret).update(payload).digest("hex");
}

function createOwnerToken() {
  const expiresAt = Date.now() + OWNER_TOKEN_TTL_MS;
  const payload = `owner:${expiresAt}`;
  const signature = signTokenPayload(payload);
  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

function isValidOwnerToken(token: string | undefined) {
  if (!token) return false;

  let decoded = "";
  try {
    decoded = Buffer.from(token, "base64url").toString("utf8");
  } catch (_error) {
    return false;
  }

  const separatorIndex = decoded.lastIndexOf(".");
  if (separatorIndex === -1) return false;

  const payload = decoded.slice(0, separatorIndex);
  const signature = decoded.slice(separatorIndex + 1);
  const expectedSignature = signTokenPayload(payload);

  const signatureBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return false;
  }

  const [scope, expiresAtRaw] = payload.split(":");
  if (scope !== "owner") return false;

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    return false;
  }

  return true;
}

function extractBearerToken(request: Request) {
  const authorization = request.header("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return undefined;
  return authorization.slice("Bearer ".length).trim();
}

function requireOwnerAuth(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const token = extractBearerToken(request);

  if (!isValidOwnerToken(token)) {
    response.status(401).json({ error: "Owner authentication is required." });
    return;
  }

  next();
}

app.use(
  cors({
    origin: [
      "https://carlos-maina-portifolio.netlify.app",
      "https://my-portifolio-alpha-indol.vercel.app",
    ], // Or specify your frontend URL
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json());

app.get("/api/health", (_request: Request, response: Response) => {
  response.json({ ok: true });
});

app.post(
  "/api/owner/login",
  asyncHandler(async (request: Request, response: Response) => {
    const password = request.body.password?.trim();

    if (!password) {
      response.status(400).json({ error: "Password is required." });
      return;
    }

    if (password !== ownerPassword) {
      response.status(401).json({ error: "Invalid owner password." });
      return;
    }

    response.json({
      message: "Owner login successful.",
      token: createOwnerToken(),
      expiresInMs: OWNER_TOKEN_TTL_MS,
    });
  }),
);

app.get("/api/owner/session", (request: Request, response: Response) => {
  response.json({
    authenticated: isValidOwnerToken(extractBearerToken(request)),
  });
});

app.get(
  "/api/projects",
  asyncHandler(async (_request: Request, response: Response) => {
    const projects = await Project.find().sort({ createdAt: -1 }).lean();

    response.json({
      projects: projects.map((project) => ({
        id: project._id.toString(),
        title: project.title,
        category: project.category,
        description: project.description,
        liveUrl: project.liveUrl,
        githubUrl: project.githubUrl,
        projectDate: project.projectDate,
        imageUrl: project.imageUrl,
        storagePath: project.storagePath,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      })),
    });
  }),
);

app.post(
  "/api/projects",
  requireOwnerAuth,
  upload.single("file"),
  asyncHandler(async (request: Request, response: Response) => {
    const file = request.file;
    const liveUrl = request.body.liveUrl?.trim() || "";
    const githubUrl = request.body.githubUrl?.trim() || "";
    const title = request.body.title?.trim();
    const category = request.body.category?.trim() || "";
    const description = request.body.description?.trim() || "";
    const projectDateInput = request.body.projectDate?.trim();

    if (!title) {
      response.status(400).json({ error: "Project title is required." });
      return;
    }

    if (!projectDateInput) {
      response.status(400).json({ error: "Project date is required." });
      return;
    }

    const projectDate = new Date(projectDateInput);
    if (Number.isNaN(projectDate.getTime())) {
      response.status(400).json({ error: "Project date is invalid." });
      return;
    }

    if (!file) {
      response.status(400).json({ error: "Project image is required." });
      return;
    }

    const extension = file.originalname.includes(".")
      ? file.originalname.slice(file.originalname.lastIndexOf("."))
      : "";
    const storagePath = `projects/${Date.now()}-${randomUUID()}${extension}`;

    const uploadResult = await supabase.storage
      .from(supabaseBucket)
      .upload(storagePath, file.buffer, {
        cacheControl: "3600",
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadResult.error) {
      response.status(500).json({ error: uploadResult.error.message });
      return;
    }

    const publicUrlResult = supabase.storage
      .from(supabaseBucket)
      .getPublicUrl(storagePath);
    const imageUrl = publicUrlResult.data.publicUrl;

    const savedProject = await Project.create({
      liveUrl,
      githubUrl,
      title,
      category,
      description,
      projectDate,
      imageUrl,
      storagePath,
    });

    response.status(201).json({
      message: "Project uploaded successfully.",
      project: {
        id: savedProject._id.toString(),
        title: savedProject.title,
        category: savedProject.category,
        description: savedProject.description,
        projectDate: savedProject.projectDate,
        imageUrl: savedProject.imageUrl,
        storagePath: savedProject.storagePath,
        createdAt: savedProject.createdAt,
      },
    });
  }),
);

app.delete(
  "/api/projects/:id",
  requireOwnerAuth,
  asyncHandler(async (request: Request, response: Response) => {
    const project = await Project.findById(request.params.id);

    if (!project) {
      response.status(404).json({ error: "Project not found." });
      return;
    }

    const deleteStorageResult = await supabase.storage
      .from(supabaseBucket)
      .remove([project.storagePath]);

    if (deleteStorageResult.error) {
      response.status(500).json({ error: deleteStorageResult.error.message });
      return;
    }

    await project.deleteOne();

    response.json({ message: "Project deleted successfully." });
  }),
);
app.use(
  (
    error: Error,
    _request: Request,
    response: Response,
    _next: NextFunction,
  ) => {
    if (error instanceof multer.MulterError) {
      response.status(400).json({ error: error.message });
      return;
    }

    response
      .status(500)
      .json({ error: error.message || "Something went wrong." });
  },
);
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});
async function startServer() {
  try {
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    process.exit(1);
  }
  app.listen(Number(PORT), () => {
    console.log(`Portfolio server running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
