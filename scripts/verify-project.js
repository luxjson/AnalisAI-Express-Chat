const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const required = [
  "src/app.js",
  "api/index.js",
  "vercel.json",
  "src/database.sql",
  "src/databaseIA.sql",
];
for (const file of required) {
  if (!fs.existsSync(path.join(ROOT, file)))
    throw new Error(`Arquivo obrigatório ausente: ${file}`);
}

const jsFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && full.endsWith(".js")) jsFiles.push(full);
  }
}
walk(ROOT);
for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ["--check", file], {
    encoding: "utf8",
  });
  if (result.status !== 0)
    throw new Error(
      `Sintaxe inválida em ${path.relative(ROOT, file)}:\n${result.stderr}`,
    );
}

const routesDir = path.join(ROOT, "src", "routes");
const controllerExports = new Map();
for (const file of fs.readdirSync(path.join(ROOT, "src", "controllers"))) {
  if (!file.endsWith(".js")) continue;
  const text = fs.readFileSync(
    path.join(ROOT, "src", "controllers", file),
    "utf8",
  );
  controllerExports.set(
    file,
    new Set(
      [...text.matchAll(/exports\.([A-Za-z0-9_]+)\s*=/g)].map((m) => m[1]),
    ),
  );
}
for (const routeFile of fs.readdirSync(routesDir)) {
  if (!routeFile.endsWith(".js")) continue;
  const text = fs.readFileSync(path.join(routesDir, routeFile), "utf8");
  for (const match of text.matchAll(
    /const\s+(\w+Controller)\s*=\s*require\(['"]\.\.\/controllers\/(.*?)(?:\.js)?['"]\)/g,
  )) {
    const [, variable, controllerPath] = match;
    const file = path.basename(controllerPath).replace(/\.js$/, "") + ".js";
    const exported = controllerExports.get(file) || new Set();
    const re = new RegExp(
      `\\b${variable.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\.([A-Za-z0-9_]+)\\b`,
      "g",
    );
    for (const handler of text.matchAll(re)) {
      if (handler[1] === "js") continue;
      if (!exported.has(handler[1]))
        throw new Error(
          `Handler inexistente: ${routeFile} -> ${file}.${handler[1]}`,
        );
    }
  }
}

console.log(
  `OK: ${jsFiles.length} arquivos JavaScript verificados e handlers das rotas validados.`,
);
