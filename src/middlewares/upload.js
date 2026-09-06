const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const uploadDir = path.join(__dirname, "../uploads");
const isServerless = Boolean(process.env.VERCEL);
if (!isServerless && !fs.existsSync(uploadDir))
  fs.mkdirSync(uploadDir, { recursive: true, mode: 0o750 });

const allowed = new Map([
  [".pdf", ["application/pdf"]],
  [".doc", ["application/msword"]],
  [
    ".docx",
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ],
  [".odt", ["application/vnd.oasis.opendocument.text"]],
  [".xls", ["application/vnd.ms-excel"]],
  [
    ".xlsx",
    ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ],
  [".csv", ["text/csv", "application/csv", "application/vnd.ms-excel"]],
  [".ppt", ["application/vnd.ms-powerpoint"]],
  [
    ".pptx",
    [
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
  ],
  [".jpg", ["image/jpeg"]],
  [".jpeg", ["image/jpeg"]],
  [".png", ["image/png"]],
  [".webp", ["image/webp"]],
  [".txt", ["text/plain"]],
  [".zip", ["application/zip"]],
  [".rar", ["application/vnd.rar", "application/x-rar-compressed"]],
]);

function safeExtension(file) {
  const ext = path.extname(file.originalname || "").toLowerCase();
  const mimeTypes = allowed.get(ext);
  return mimeTypes && mimeTypes.includes(file.mimetype) ? ext : null;
}

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) =>
    cb(
      null,
      `tarefa-${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`,
    ),
});

const upload = multer({
  storage: isServerless ? multer.memoryStorage() : diskStorage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 30, parts: 35 },
  fileFilter: (_req, file, cb) =>
    safeExtension(file)
      ? cb(null, true)
      : cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "arquivo")),
});

module.exports = upload;
module.exports.uploadDir = uploadDir;
module.exports.isServerless = isServerless;
module.exports.makeStorageKey = (file) =>
  `tarefa-${crypto.randomUUID()}${path.extname(file.originalname || "").toLowerCase()}`;
