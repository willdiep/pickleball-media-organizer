import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import path from "path";
import fs from "fs";
import fsPromises from "fs/promises";
import { fileURLToPath, pathToFileURL } from "url";
import { PrismaClient, MediaType } from "@prisma/client";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = process.env.NODE_ENV !== "production";

// Ensure the database lives in a predictable workspace location unless overridden
const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const databasePath =
  process.env.DATABASE_URL || `file:${path.join(dataDir, "pickleball.db")}`;
process.env.DATABASE_URL = databasePath;

const prisma = new PrismaClient();
const supportedVideos = new Set([".mp4", ".mov", ".m4v", ".webm", ".avi"]);
const supportedPhotos = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);

const createWindow = async () => {
  const mainWindow = new BrowserWindow({
    width: 2160,
    height: 1280,
    backgroundColor: "#f8fafc",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
      // Allow loading local file:// media while the renderer runs on http://localhost during dev
      webSecurity: !isDev,
    },
  });

  if (isDev) {
    await mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    const indexPath = path.join(__dirname, "dist", "index.html");
    await mainWindow.loadFile(indexPath);
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
};

const walkDirectory = async (dir) => {
  const files = [];
  let entries = [];

  try {
    entries = await fsPromises.readdir(dir, { withFileTypes: true });
  } catch (error) {
    console.error("Failed to read directory", dir, error);
    return files;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await walkDirectory(fullPath);
      files.push(...nested);
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
};

const inferMediaType = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  if (supportedVideos.has(ext)) return MediaType.VIDEO;
  if (supportedPhotos.has(ext)) return MediaType.PHOTO;
  return null;
};

const ingestMediaFromDirectory = async (directory) => {
  const files = await walkDirectory(directory);
  let imported = 0;
  let skipped = 0;

  for (const filePath of files) {
    const mediaType = inferMediaType(filePath);
    if (!mediaType) {
      skipped += 1;
      continue;
    }

    const filename = path.basename(filePath);
    try {
      await prisma.media.upsert({
        where: { filepath: filePath },
        update: {},
        create: {
          uuid: crypto.randomUUID(),
          filename,
          filepath: filePath,
          mediatype: mediaType,
        },
      });
      imported += 1;
    } catch (error) {
      console.error("Failed to ingest file", filePath, error);
      skipped += 1;
    }
  }

  return { imported, skipped };
};

const normalizeMedia = (media) => ({
  ...media,
  fileUrl: pathToFileURL(media.filepath).href,
  tags: media.tags?.map((mt) => mt.tag) ?? [],
});

const registerIpcHandlers = () => {
  ipcMain.handle("media:list", async () => {
    const [media, tags] = await Promise.all([
      prisma.media.findMany({
        orderBy: { createdAt: "desc" },
        include: { tags: { include: { tag: true } } },
      }),
      prisma.tag.findMany({ orderBy: { name: "asc" } }),
    ]);

    return { media: media.map(normalizeMedia), tags };
  });

  ipcMain.handle("media:add-folder", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ["openDirectory"],
    });
    if (canceled || !filePaths.length) {
      return { imported: 0, skipped: 0 };
    }

    const results = { imported: 0, skipped: 0 };
    for (const folder of filePaths) {
      const { imported, skipped } = await ingestMediaFromDirectory(folder);
      results.imported += imported;
      results.skipped += skipped;
    }

    const media = await prisma.media.findMany({
      orderBy: { createdAt: "desc" },
      include: { tags: { include: { tag: true } } },
    });
    const tags = await prisma.tag.findMany({ orderBy: { name: "asc" } });

    return { ...results, media: media.map(normalizeMedia), tags };
  });

  ipcMain.handle("media:get", async (_event, mediaId) => {
    const media = await prisma.media.findUnique({
      where: { id: mediaId },
      include: { tags: { include: { tag: true } } },
    });
    if (!media) return null;
    
    console.log(normalizeMedia(media));
    return normalizeMedia(media);
  });

  ipcMain.handle("media:update-tags", async (_event, payload) => {
    const { mediaId, tags } = payload;
    const tagNames = (tags || [])
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    await prisma.$transaction(async (tx) => {
      const existingTags = await tx.tag.findMany({
        where: { name: { in: tagNames } },
      });

      const existingNames = new Set(existingTags.map((t) => t.name));
      const toCreate = tagNames.filter((name) => !existingNames.has(name));

      const createdTags = await Promise.all(
        toCreate.map((name) => tx.tag.create({ data: { name } }))
      );

      const finalTags = [...existingTags, ...createdTags];

      await tx.media.update({
        where: { id: mediaId },
        data: {
          tags: {
            deleteMany: {},
            create: finalTags.map((tag) => ({ tagId: tag.id })),
          },
        },
      });
    });

    const media = await prisma.media.findUnique({
      where: { id: mediaId },
      include: { tags: { include: { tag: true } } },
    });
    const tagsList = await prisma.tag.findMany({ orderBy: { name: "asc" } });

    return { media: normalizeMedia(media), tags: tagsList };
  });

  ipcMain.handle("tags:list", async () => {
    return prisma.tag.findMany({ orderBy: { name: "asc" } });
  });

  ipcMain.handle("media:update-description", async (_event, payload) => {
    const { mediaId, description } = payload;
    const normalizedDescription =
      typeof description === "string" ? description.trim() : null;
    const media = await prisma.media.update({
      where: { id: mediaId },
      data: { description: normalizedDescription || null },
      include: { tags: { include: { tag: true } } },
    });
    return { media: normalizeMedia(media) };
  });

  ipcMain.handle("media:delete", async (_event, mediaId) => {
    if (!mediaId) {
      return { media: [], tags: [] };
    }

    await prisma.$transaction(async (tx) => {
      await tx.mediaTag.deleteMany({ where: { mediaId } });
      await tx.media.delete({ where: { id: mediaId } });
    });

    const [media, tags] = await Promise.all([
      prisma.media.findMany({
        orderBy: { createdAt: "desc" },
        include: { tags: { include: { tag: true } } },
      }),
      prisma.tag.findMany({ orderBy: { name: "asc" } }),
    ]);

    return { media: media.map(normalizeMedia), tags };
  });
};

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    prisma.$disconnect();
    app.quit();
  }
});

app.on("before-quit", () => {
  prisma.$disconnect();
});

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
