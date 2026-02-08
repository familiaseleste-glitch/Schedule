import http from "http";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const PROFILE_FILE = path.join(DATA_DIR, "profiles.json");
const PUBLIC_DIR = path.join(__dirname, "public");

const safeProfiles = ["iniciante", "intermediario", "intermediário"];

const ensureDataFile = async () => {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(PROFILE_FILE);
  } catch {
    await fs.writeFile(PROFILE_FILE, JSON.stringify({ profiles: [] }, null, 2));
  }
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const buildCalisthenicsPlan = (profile, difficultyBoost) => {
  const level = safeProfiles.includes(profile.fitnessLevel) ? profile.fitnessLevel : "iniciante";
  const isBeginner = level === "iniciante";
  const baseSets = isBeginner ? 2 : 3;
  const baseReps = isBeginner ? 8 : 12;
  const rest = isBeginner ? "60-75s" : "45-60s";
  const extra = clamp(difficultyBoost, -1, 1);
  const sets = clamp(baseSets + extra, 1, 4);
  const reps = clamp(baseReps + extra * 2, 6, 15);

  return {
    focus: "Força e mobilidade com peso corporal",
    duration: `${clamp(profile.timeAvailable || 30, 15, 60)} min`,
    exercises: [
      { name: "Agachamento livre", sets, reps, rest, tip: "Joelhos alinhados com os pés." },
      { name: "Flexão inclinada", sets, reps, rest, tip: "Mantenha o core firme." },
      { name: "Prancha", sets: clamp(sets - 1, 1, 3), reps: "30-45s", rest: "45s", tip: "Coluna neutra." },
      { name: "Elevação de quadril", sets, reps, rest, tip: "Contraia glúteos no topo." }
    ],
    safety: "Sem cargas pesadas. Priorize técnica e pausa se houver dor."
  };
};

const buildNutritionPlan = (profile) => {
  const goal = profile.goals || "saúde";
  const mealFocus = goal === "ganho de massa" ? "proteínas e carboidratos" : "equilíbrio de macros";
  return {
    focus: `Comidas simples com ${mealFocus}.`,
    meals: {
      breakfast: "Pão integral + ovos mexidos + fruta",
      lunch: "Arroz, feijão, frango grelhado e salada",
      snack: "Iogurte natural + granola + banana",
      dinner: "Sopa de legumes + torrada integral"
    },
    notes: "Beba água durante o dia e evite dietas restritivas."
  };
};

const buildSkinCarePlan = (profile) => {
  const skinType = profile.skinType || "mista";
  const morning = [
    "Lavar com sabonete suave",
    "Hidratante leve",
    "Protetor solar FPS 30+"
  ];
  const night = [
    "Lavar o rosto",
    "Hidratante com textura adequada"
  ];
  const adjustments = {
    oleosa: "Prefira produtos oil-free.",
    mista: "Use hidratante em gel nas zonas oleosas.",
    seca: "Aposte em hidratantes mais cremosos."
  };
  return {
    skinType,
    morning,
    night,
    reminder: "Reaplique protetor solar quando estiver ao ar livre.",
    note: adjustments[skinType] || adjustments.mista
  };
};

const buildDailyOrganization = (profile) => {
  return {
    blocks: [
      "Manhã: 10 min de planejamento + rotina de higiene",
      "Tarde: estudo com pausas de 5 min a cada 45 min",
      "Noite: desligar telas 30 min antes de dormir"
    ],
    timeManagement: `Tempo disponível: ${profile.timeAvailable || 30} min para foco pessoal.`
  };
};

const buildRoutine = (profile, feedback) => {
  const difficultyBoost = feedback === "dificil" ? -1 : feedback === "facil" ? 1 : 0;
  return {
    summary: "Rotina adaptada para adolescentes com foco em saúde e constância.",
    calisthenics: buildCalisthenicsPlan(profile, difficultyBoost),
    nutrition: buildNutritionPlan(profile),
    skincare: buildSkinCarePlan(profile),
    organization: buildDailyOrganization(profile),
    wellness: [
      "Durma de 8 a 9 horas.",
      "Evite comparações e avance no seu ritmo.",
      "Se sentir desconforto, diminua a intensidade."
    ]
  };
};

const sendJson = (res, status, payload) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
};

const readBody = (req) => new Promise((resolve, reject) => {
  let data = "";
  req.on("data", (chunk) => {
    data += chunk;
  });
  req.on("end", () => {
    if (!data) {
      resolve({});
      return;
    }
    try {
      resolve(JSON.parse(data));
    } catch (error) {
      reject(error);
    }
  });
  req.on("error", reject);
});

const getFilePath = (url) => {
  const cleanUrl = url === "/" ? "/index.html" : url;
  const safePath = path.normalize(cleanUrl).replace(/^\.+/, "");
  return path.join(PUBLIC_DIR, safePath);
};

const mimeTypes = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg"
};

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/api/")) {
      if (req.method === "POST" && req.url === "/api/personalize") {
        const body = await readBody(req);
        const profile = body.profile || {};
        const feedback = body.feedback || "medio";
        if (!profile.age || !profile.height || !profile.weight) {
          return sendJson(res, 400, { error: "Informe idade, altura e peso." });
        }
        const routine = buildRoutine(profile, feedback);
        return sendJson(res, 200, { routine });
      }

      if (req.method === "POST" && req.url === "/api/save-profile") {
        await ensureDataFile();
        const body = await readBody(req);
        const profile = body.profile;
        if (!profile?.name) {
          return sendJson(res, 400, { error: "Nome do perfil é obrigatório." });
        }
        const data = JSON.parse(await fs.readFile(PROFILE_FILE, "utf-8"));
        const updatedProfiles = data.profiles.filter((item) => item.name !== profile.name);
        updatedProfiles.push({ ...profile, updatedAt: new Date().toISOString() });
        await fs.writeFile(PROFILE_FILE, JSON.stringify({ profiles: updatedProfiles }, null, 2));
        return sendJson(res, 200, { ok: true });
      }

      if (req.method === "GET" && req.url === "/api/profiles") {
        await ensureDataFile();
        const data = JSON.parse(await fs.readFile(PROFILE_FILE, "utf-8"));
        return sendJson(res, 200, { profiles: data.profiles });
      }

      return sendJson(res, 404, { error: "Rota não encontrada." });
    }

    const filePath = getFilePath(req.url);
    const fileExt = path.extname(filePath);
    const contentType = mimeTypes[fileExt] || "text/plain";
    const file = await fs.readFile(filePath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(file);
  } catch (error) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Erro interno do servidor");
  }
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
