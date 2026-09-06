const crypto = require("crypto");

const ALLOWED_YEARS = ["1º MÉDIO", "2º MÉDIO", "3º MÉDIO", "9º FUNDAMENTAL"];
const ALLOWED_CARGOS = ["Professor", "Admin"];
const ALLOWED_STATUS = ["ATIVO", "INATIVO"];
const ALLOWED_PRIORITY = ["BAIXA", "MEDIA", "ALTA"];
const ALLOWED_TASK_STATUS = ["ATIVA", "INATIVA"];

function text(value, max, { min = 0, trim = true } = {}) {
  if (typeof value !== "string" || !Number.isInteger(max) || max < 0)
    return null;
  const result = trim ? value.trim() : value;
  if (result.length < min || result.length > max) return null;
  return result;
}

function personName(value, max = 100) {
  const result = text(value, max, { min: 2 });
  return result &&
    /^(?:\p{L}|\p{M})+(?:[\s'-]+(?:\p{L}|\p{M})+)*$/u.test(result)
    ? result
    : null;
}

function email(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))
    return null;
  return normalized;
}

function password(value) {
  if (typeof value !== "string" || value.length < 12 || value.length > 128)
    return null;
  return value;
}

function integerId(value) {
  if (!/^\d+$/.test(String(value))) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function numberInRange(value, min, max) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

function hexColor(value) {
  if (typeof value !== "string") return null;
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : null;
}

function booleanValue(value) {
  if (value === true || value === false) return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function dateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? value
    : null;
}

function randomPassword() {
  return crypto.randomBytes(9).toString("base64url");
}

function normalizeToEmailName(name) {
  if (typeof name !== "string") return "";
  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const cleaned = normalized.replace(/[^a-zA-Z0-9\s.]/g, "");
  return cleaned
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\.|\.$/g, "");
}

function generateStudentEmail(name) {
  const base = normalizeToEmailName(name) || "aluno";
  const randomNum = crypto.randomInt(100000, 1000000);
  return `${base}${randomNum}@aluno.analisai.com`;
}

function escapeJsonForHtml(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

module.exports = {
  ALLOWED_YEARS,
  ALLOWED_CARGOS,
  ALLOWED_STATUS,
  ALLOWED_PRIORITY,
  ALLOWED_TASK_STATUS,
  text,
  personName,
  email,
  password,
  integerId,
  numberInRange,
  hexColor,
  booleanValue,
  dateOnly,
  randomPassword,
  escapeJsonForHtml,
  normalizeToEmailName,
  generateStudentEmail,
};
