

const SPOONACULAR_API_KEY = "a322ddf9ef2b42c781f2c50f9acaad5d";
/* ================================================================================== */

if (!SPOONACULAR_API_KEY || SPOONACULAR_API_KEY === "YOUR_SPOONACULAR_API_KEY") {
  console.warn(
    "Spoonacular API key not set. Replace the placeholder in app.js or set window.SPOONACULAR_API_KEY with your key."
  );
}

/* API helpers */
const API_BASE = "https://api.spoonacular.com";

/**
 * Search recipes by ingredient list using Spoonacular's findByIngredients endpoint.
 * Returns an array of recipes (each contains id, title, image, usedIngredients, missedIngredients, etc.)
 */
async function searchRecipesByIngredients(ingredients, number = 12) {
  const q = encodeURIComponent(ingredients);
  const url = `${API_BASE}/recipes/findByIngredients?ingredients=${q}&number=${number}&ranking=1&ignorePantry=true&apiKey=${SPOONACULAR_API_KEY}`;

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Search error: ${res.status} ${text}`);
  }
  return res.json();
}

/**
 * Get full recipe information (ingredients, instructions, time, servings).
 */
async function getRecipeInformation(recipeId) {
  const url = `${API_BASE}/recipes/${recipeId}/information?includeNutrition=false&apiKey=${SPOONACULAR_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Recipe info error: ${res.status} ${text}`);
  }
  return res.json();
}

/* ====== UI helpers and state ====== */

const elements = {
  ingredientsInput: document.getElementById("ingredients-input"),
  searchBtn: document.getElementById("search-btn"),
  resultsList: document.getElementById("results-list"),
  detailsContent: document.getElementById("details-content"),
  favoritesList: document.getElementById("favorites-list"),
};

let currentResults = []; // store last search results
let favorites = [];

/* ====== Local storage helpers ====== */
const FAVORITES_KEY = "aiRecipeFinder.favorites";

function loadFavoritesFromStorage() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveFavoritesToStorage() {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
}

function isFavorited(id) {
  return favorites.some((f) => f.id === id);
}

function addFavorite(recipe) {
  if (!isFavorited(recipe.id)) {
    favorites.unshift({ id: recipe.id, title: recipe.title, image: recipe.image });
    saveFavoritesToStorage();
    renderFavorites();
  }
}

function removeFavorite(id) {
  favorites = favorites.filter((f) => f.id !== id);
  saveFavoritesToStorage();
  renderFavorites();
}

/* ====== Rendering functions ====== */

function showLoadingResults() {
  elements.resultsList.innerHTML = `
    <div class="text-textDim py-6">Searching recipes…</div>
  `;
}

function showEmptyResults(message = "No recipes found.") {
  elements.resultsList.innerHTML = `
    <div class="text-textDim py-6">${message}</div>
  `;
}

function renderResults(recipes) {
  currentResults = recipes;
  if (!recipes || recipes.length === 0) {
    showEmptyResults();
    return;
  }

  // Create recipe cards
  elements.resultsList.innerHTML = "";
  recipes.forEach((r) => {
    const card = document.createElement("div");
    card.className = "flex gap-3 items-center p-3 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.03)] cursor-pointer hover:scale-[1.01] transition";

    card.innerHTML = `
      <img src="${r.image}" alt="${escapeHtml(r.title)}" class="w-20 h-20 rounded-md object-cover flex-shrink-0"/>
      <div class="flex-1 min-w-0">
        <div class="flex items-start justify-between gap-3">
          <h4 class="text-sm font-semibold text-textLight truncate">${escapeHtml(r.title)}</h4>
          <div class="flex-shrink-0 space-x-2">
            <button data-recipe-id="${r.id}" class="view-details text-sm px-2 py-1 rounded bg-[rgba(0,0,0,0.35)] hover:bg-[rgba(0,0,0,0.45)] text-textDim">View</button>
            <button data-add-fav="${r.id}" class="save-fav text-sm px-2 py-1 rounded ${isFavorited(r.id) ? "bg-spice text-white" : "bg-[rgba(245,158,11,0.95)] text-black"}">
              ${isFavorited(r.id) ? "Saved" : "Save"}
            </button>
          </div>
        </div>
        <div class="mt-2 text-xs text-textDim flex gap-2 flex-wrap">
          <span class="inline-block bg-[rgba(255,255,255,0.02)] px-2 py-0.5 rounded">${r.usedIngredients.length} used</span>
          <span class="inline-block bg-[rgba(255,255,255,0.02)] px-2 py-0.5 rounded">${r.missedIngredients.length} missing</span>
        </div>
      </div>
    `;

    // Attach events (delegation safer, but this is fine for small lists)
    const viewBtn = card.querySelector(".view-details");
    viewBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      showRecipeDetails(r.id);
    });

    const saveBtn = card.querySelector(".save-fav");
    saveBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (isFavorited(r.id)) {
        removeFavorite(r.id);
        saveBtn.classList.remove("bg-spice", "text-white");
        saveBtn.classList.add("bg-[rgba(245,158,11,0.95)]", "text-black");
        saveBtn.textContent = "Save";
      } else {
        addFavorite(r);
        saveBtn.classList.add("bg-spice", "text-white");
        saveBtn.classList.remove("bg-[rgba(245,158,11,0.95)]", "text-black");
        saveBtn.textContent = "Saved";
      }
    });

    // Clicking card itself shows details
    card.addEventListener("click", () => showRecipeDetails(r.id));

    elements.resultsList.appendChild(card);
  });
}

function renderFavorites() {
  elements.favoritesList.innerHTML = "";
  if (!favorites.length) {
    elements.favoritesList.innerHTML = `<p class="text-textDim">No favorites yet. Start saving recipes!</p>`;
    return;
  }

  favorites.forEach((f) => {
    const item = document.createElement("div");
    item.className = "flex items-center gap-3 p-2 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.03)]";
    item.innerHTML = `
      <img src="${f.image}" alt="${escapeHtml(f.title)}" class="w-12 h-12 rounded-md object-cover"/>
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between gap-2">
          <div class="text-sm text-textLight truncate">${escapeHtml(f.title)}</div>
          <div class="flex gap-2">
            <button data-open="${f.id}" class="text-xs px-2 py-1 rounded bg-[rgba(0,0,0,0.35)] text-textDim">Open</button>
            <button data-remove="${f.id}" class="text-xs px-2 py-1 rounded bg-[rgba(255,0,0,0.08)] text-spice">Remove</button>
          </div>
        </div>
      </div>
    `;

    item.querySelector("[data-open]").addEventListener("click", () => showRecipeDetails(f.id));
    item.querySelector("[data-remove]").addEventListener("click", () => removeFavorite(f.id));

    elements.favoritesList.appendChild(item);
  });
}

/* ====== Details pane rendering & AI explanation ====== */

function showDetailsLoading() {
  elements.detailsContent.innerHTML = `<p class="text-textDim">Loading details…</p>`;
}

/**
 * Generate a friendly "AI-style" explanation for the recipe based on data.
 * This is a deterministic front-end generator designed to be replaceable by an LLM later.
 */
function generateAIExplanation(recipeInfo, searchIngredients = "") {
  // recipeInfo: Spoonacular recipe information object
  // searchIngredients: string used in last search (to reference what the user had)

  const title = recipeInfo.title || "This recipe";
  const readyIn = recipeInfo.readyInMinutes || null;
  const servings = recipeInfo.servings || null;
  const ingredientCount = (recipeInfo.extendedIngredients || []).length;

  // Build phrases
  const timePhrase = readyIn ? `takes about ${readyIn} minutes` : "has a short prep time";
  const servingPhrase = servings ? `serves ${servings}` : "serves multiple";
  const proteinHint = detectProteinPresence(recipeInfo.extendedIngredients || []);
  const difficulty = estimateDifficulty(recipeInfo);

  // Reference user's ingredients if provided
  const userRef = searchIngredients ? ` using your ${searchIngredients}` : "";

  // Compose explanation
  let explanation = `${title} ${timePhrase} and ${servingPhrase}.${userRef} `;
  explanation += `${proteinHint} ${difficulty}. `;
  explanation += `Key ingredients: ${(recipeInfo.extendedIngredients || []).slice(0,3).map(i => i.name).join(", ")}.`;

  return explanation;
}

function detectProteinPresence(ingredients) {
  const proteinKeywords = ["chicken", "beef", "pork", "salmon", "tuna", "egg", "tofu", "lentil", "chickpea"];
  const names = ingredients.map(i => (i.name || "").toLowerCase());
  for (const k of proteinKeywords) {
    if (names.some(n => n.includes(k))) {
      return `This is a protein-forward dish (${k}).`;
    }
  }
  return "Vegetarian-friendly or light on protein.";
}

function estimateDifficulty(recipeInfo) {
  const time = recipeInfo.readyInMinutes || 0;
  const steps = countInstructionSteps(recipeInfo.analyzedInstructions || []);
  if (time < 20 && steps <= 5) return "Quick and easy to make";
  if (time < 45 && steps <= 10) return "Moderately easy";
  return "A bit more involved";
}

function countInstructionSteps(analyzedInstructions) {
  if (!Array.isArray(analyzedInstructions) || !analyzedInstructions.length) return 0;
  // Sum steps across instruction sections
  return analyzedInstructions.reduce((sum, section) => sum + (section.steps ? section.steps.length : 0), 0);
}

async function showRecipeDetails(recipeId) {
  try {
    showDetailsLoading();
    const info = await getRecipeInformation(recipeId);

    // Build details HTML
    const ingredientsHtml = (info.extendedIngredients || []).map(i => `<li>${escapeHtml(i.original)}</li>`).join("");
    const instructions = info.instructions || (info.analyzedInstructions && info.analyzedInstructions[0] && info.analyzedInstructions[0].steps.map(s => s.step).join(" ")) || "";
    const sourceUrl = info.sourceUrl || info.spoonacularSourceUrl || "#";
    const aiExplanation = generateAIExplanation(info, elements.ingredientsInput.value);

    elements.detailsContent.innerHTML = `
      <div>
        <div class="flex items-start gap-4">
          <img src="${info.image}" alt="${escapeHtml(info.title)}" class="w-32 h-24 rounded-md object-cover flex-shrink-0"/>
          <div class="flex-1 min-w-0">
            <h3 class="text-lg font-semibold text-textLight">${escapeHtml(info.title)}</h3>
            <div class="text-sm text-textDim mt-1">⏱ ${info.readyInMinutes || "—"} min • 🍽 ${info.servings || "—"} servings</div>
            <div class="mt-3 flex gap-2">
              <a href="${sourceUrl}" target="_blank" rel="noopener noreferrer" class="text-xs px-3 py-2 rounded bg-[rgba(245,158,11,0.95)] text-black">Open full recipe</a>
              <button id="detail-save-btn" class="text-xs px-3 py-2 rounded ${isFavorited(info.id) ? "bg-spice text-white" : "bg-[rgba(0,0,0,0.35)] text-textDim"}">
                ${isFavorited(info.id) ? "Saved" : "Save"}
              </button>
            </div>
          </div>
        </div>

        <div class="mt-4 grid md:grid-cols-2 gap-4">
          <div>
            <h4 class="text-sm font-semibold text-textLight mb-2">Ingredients</h4>
            <ul class="text-sm text-textDim list-disc pl-5">${ingredientsHtml}</ul>
          </div>

          <div>
            <h4 class="text-sm font-semibold text-textLight mb-2">AI-style Explanation</h4>
            <p class="text-sm text-textDim italic">${escapeHtml(aiExplanation)}</p>

            <h4 class="text-sm font-semibold text-textLight mt-4 mb-2">Instructions (excerpt)</h4>
            <p class="text-sm text-textDim">${escapeHtml(instructions ? instructions.slice(0, 400) + (instructions.length > 400 ? "…" : "") : "No instructions available")}</p>
          </div>
        </div>
      </div>
    `;

    // Save button inside details
    const detailSaveBtn = document.getElementById("detail-save-btn");
    detailSaveBtn.addEventListener("click", () => {
      if (isFavorited(info.id)) {
        removeFavorite(info.id);
        detailSaveBtn.classList.remove("bg-spice", "text-white");
        detailSaveBtn.classList.add("bg-[rgba(0,0,0,0.35)]", "text-textDim");
        detailSaveBtn.textContent = "Save";
      } else {
        addFavorite({ id: info.id, title: info.title, image: info.image });
        detailSaveBtn.classList.add("bg-spice", "text-white");
        detailSaveBtn.classList.remove("bg-[rgba(0,0,0,0.35)]", "text-textDim");
        detailSaveBtn.textContent = "Saved";
      }
    });
  } catch (err) {
    console.error(err);
    elements.detailsContent.innerHTML = `<p class="text-spice">Failed to load details. ${escapeHtml(err.message)}</p>`;
  }
}

/* ====== Event wiring & search flow ====== */

async function handleSearch() {
  const raw = elements.ingredientsInput.value.trim();
  if (!raw) {
    alert("Please enter at least one ingredient (comma separated).");
    return;
  }

  showLoadingResults();
  elements.detailsContent.innerHTML = `<p class="text-textDim">Select a recipe to see details here.</p>`;

  try {
    const recipes = await searchRecipesByIngredients(raw, 12);
    renderResults(recipes);
  } catch (err) {
    console.error(err);
    elements.resultsList.innerHTML = `<p class="text-spice">Search failed: ${escapeHtml(err.message)}</p>`;
  }
}

/* ====== Utilities ====== */

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ====== Boot ====== */

document.addEventListener("DOMContentLoaded", () => {
  

  favorites = loadFavoritesFromStorage();
renderFavorites();
// Wire search button & Enter key
  elements.searchBtn.addEventListener("click", handleSearch);
  elements.ingredientsInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSearch();
  });

 
  
});
