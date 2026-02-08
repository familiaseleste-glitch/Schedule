const form = document.getElementById("profileForm");
const generateRoutineBtn = document.getElementById("generateRoutine");
const generateRoutineTop = document.getElementById("generateRoutineTop");
const startNow = document.getElementById("startNow");
const saveProfileBtn = document.getElementById("saveProfile");
const loadProfileBtn = document.getElementById("loadProfile");
const exportPdfBtn = document.getElementById("exportPdf");
const themeToggle = document.getElementById("themeToggle");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const feedbackButtons = document.querySelectorAll("[data-feedback]");
const feedbackMessage = document.getElementById("feedbackMessage");

const cards = {
  calisthenics: document.querySelector("#cardCalisthenics .card-body"),
  nutrition: document.querySelector("#cardNutrition .card-body"),
  skincare: document.querySelector("#cardSkincare .card-body"),
  organization: document.querySelector("#cardOrganization .card-body")
};

const state = {
  profile: null,
  feedback: "medio"
};

const STORAGE_KEYS = {
  profile: "pulse_profile",
  progress: "pulse_progress",
  theme: "pulse_theme"
};

const setTheme = (theme) => {
  document.body.classList.remove("light", "dark");
  document.body.classList.add(theme);
  localStorage.setItem(STORAGE_KEYS.theme, theme);
};

const initTheme = () => {
  const stored = localStorage.getItem(STORAGE_KEYS.theme);
  if (stored) {
    setTheme(stored);
    return;
  }
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  setTheme(prefersDark ? "dark" : "light");
};

const updateProgress = (increment = false) => {
  const current = Number(localStorage.getItem(STORAGE_KEYS.progress)) || 0;
  const next = increment ? Math.min(current + 15, 100) : current;
  localStorage.setItem(STORAGE_KEYS.progress, String(next));
  progressBar.style.width = `${next}%`;
  progressText.textContent = `${next}%`;
};

const buildList = (items) => `
  <ul>
    ${items.map((item) => `<li>${item}</li>`).join("")}
  </ul>
`;

const renderRoutine = (routine) => {
  cards.calisthenics.innerHTML = `
    <p><strong>${routine.calisthenics.focus}</strong> • ${routine.calisthenics.duration}</p>
    ${buildList(
      routine.calisthenics.exercises.map(
        (exercise) =>
          `${exercise.name}: ${exercise.sets}x${exercise.reps} (${exercise.rest}) — ${exercise.tip}`
      )
    )}
    <p class="muted">${routine.calisthenics.safety}</p>
  `;

  cards.nutrition.innerHTML = `
    <p>${routine.nutrition.focus}</p>
    ${buildList([
      `Café: ${routine.nutrition.meals.breakfast}`,
      `Almoço: ${routine.nutrition.meals.lunch}`,
      `Lanche: ${routine.nutrition.meals.snack}`,
      `Jantar: ${routine.nutrition.meals.dinner}`
    ])}
    <p class="muted">${routine.nutrition.notes}</p>
  `;

  cards.skincare.innerHTML = `
    <p><strong>Pele ${routine.skincare.skinType}</strong></p>
    ${buildList([`Manhã: ${routine.skincare.morning.join(" → ")}`, `Noite: ${routine.skincare.night.join(" → ")}`])}
    <p class="muted">${routine.skincare.reminder}</p>
    <p class="muted">${routine.skincare.note}</p>
  `;

  cards.organization.innerHTML = `
    ${buildList(routine.organization.blocks)}
    <p class="muted">${routine.organization.timeManagement}</p>
  `;
};

const collectProfile = () => {
  const data = Object.fromEntries(new FormData(form));
  return {
    name: data.name,
    age: Number(data.age),
    height: Number(data.height),
    weight: Number(data.weight),
    gender: data.gender,
    fitnessLevel: data.fitnessLevel,
    hairType: data.hairType,
    skinType: data.skinType,
    goals: data.goals,
    timeAvailable: Number(data.timeAvailable),
    restrictions: data.restrictions
  };
};

const saveProfileLocal = (profile) => {
  localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
};

const loadProfileLocal = () => {
  const stored = localStorage.getItem(STORAGE_KEYS.profile);
  return stored ? JSON.parse(stored) : null;
};

const fillForm = (profile) => {
  if (!profile) return;
  Object.entries(profile).forEach(([key, value]) => {
    const field = form.elements[key];
    if (field) field.value = value;
  });
};

const personalize = async (profile) => {
  const response = await fetch("/api/personalize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile, feedback: state.feedback })
  });

  if (!response.ok) {
    const error = await response.json();
    alert(error.error || "Erro ao gerar rotina");
    return null;
  }

  const data = await response.json();
  return data.routine;
};

const saveProfileServer = async (profile) => {
  await fetch("/api/save-profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile })
  });
};

const handleGenerate = async (profile) => {
  const routine = await personalize(profile);
  if (!routine) return;
  renderRoutine(routine);
  updateProgress(true);
  feedbackMessage.textContent = "Rotina gerada! Diga como foi para ajustar a próxima.";
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const profile = collectProfile();
  state.profile = profile;
  saveProfileLocal(profile);
  await saveProfileServer(profile);
  await handleGenerate(profile);
});

saveProfileBtn.addEventListener("click", async () => {
  const profile = collectProfile();
  state.profile = profile;
  saveProfileLocal(profile);
  await saveProfileServer(profile);
  alert("Perfil salvo com sucesso!");
});

loadProfileBtn.addEventListener("click", () => {
  const profile = loadProfileLocal();
  if (!profile) {
    alert("Nenhum perfil salvo localmente.");
    return;
  }
  fillForm(profile);
  state.profile = profile;
});

const ensureProfile = () => {
  if (state.profile) return state.profile;
  const stored = loadProfileLocal();
  if (stored) {
    state.profile = stored;
    return stored;
  }
  alert("Preencha o perfil primeiro.");
  return null;
};

generateRoutineBtn.addEventListener("click", async () => {
  const profile = ensureProfile();
  if (!profile) return;
  await handleGenerate(profile);
});

generateRoutineTop.addEventListener("click", async () => {
  const profile = ensureProfile();
  if (!profile) {
    document.getElementById("profile").scrollIntoView({ behavior: "smooth" });
    return;
  }
  await handleGenerate(profile);
});

startNow.addEventListener("click", () => {
  document.getElementById("profile").scrollIntoView({ behavior: "smooth" });
});

exportPdfBtn.addEventListener("click", () => {
  window.print();
});

feedbackButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.feedback = button.dataset.feedback;
    feedbackMessage.textContent = `Feedback registrado: ${button.textContent}. A próxima rotina será ajustada.`;
  });
});

themeToggle.addEventListener("click", () => {
  const next = document.body.classList.contains("dark") ? "light" : "dark";
  setTheme(next);
});

initTheme();
updateProgress(false);

const storedProfile = loadProfileLocal();
if (storedProfile) {
  fillForm(storedProfile);
  state.profile = storedProfile;
}
