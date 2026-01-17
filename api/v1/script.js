const API_BASE = "/metadata/api";
let token = localStorage.getItem("token");
let currentMediaId = null;
let currentRulesetId = null;

// DOM Elements
const loginSection = document.getElementById("login-section");
const mediaSection = document.getElementById("media-section");
const rulesetSection = document.getElementById("ruleset-section");
const mediaSelect = document.getElementById("media-select");
const rulesetList = document.getElementById("ruleset-list");

const mediaFormSection = document.getElementById("media-form-section");
const mediaForm = document.getElementById("media-form");

const addFilterButton = document.getElementById("add-filter");
const filterList = document.getElementById("filter-list");
const addTitleRegexButton = document.getElementById("add-title-regex");
const titleRegexList = document.getElementById("title-regex-list");
const titleRegexRulesJSON = document.getElementById("titleRegexRulesJSON");

const rulesetForm = document.getElementById("ruleset-form");

const loginForm = document.getElementById("login-form");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const loginError = document.getElementById("login-error");

const addMediaToggle = document.getElementById("add-media-toggle");

// Helpers
const switchToMediaSection = () => {
  loginSection.classList.add("hidden");
  mediaSection.classList.remove("hidden");
};

const switchToLoginSection = () => {
  mediaSection.classList.add("hidden");
  loginSection.classList.remove("hidden");
};

if (token) {
  switchToMediaSection();
  loadMedia();
}

// Toggle Add Media Form
addMediaToggle.addEventListener("click", () => {
  mediaFormSection.classList.toggle("hidden");
});

// Login
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = usernameInput.value;
  const password = passwordInput.value;

  try {
    const res = await fetch(`${API_BASE}/auth.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) throw new Error("Invalid credentials");

    const data = await res.json();
    token = data.token;
    localStorage.setItem("token", token);
    switchToMediaSection();
    loadMedia();
  } catch (err) {
    loginError.textContent = err.message;
  }
});

// Load Media
async function loadMedia() {
  try {
    const res = await fetch(`${API_BASE}/media.php`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error("Failed to load media");

    const media = await res.json();
    mediaSelect.innerHTML = '<option value="" disabled selected>-- Select Media --</option>';
    media.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = `${item.name} (${item.type})`;
      mediaSelect.appendChild(option);
    });
  } catch (err) {
    alert(err.message);
  }
}

// Saving Ruleset
rulesetForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const topic = document.getElementById("ruleset-topic").value;
  const priority = document.getElementById("ruleset-priority").value;

  const filters = Array.from(filterList.children).map((li) => ({
    attribute: li.querySelector(".filter-attribute").value,
    type: li.querySelector(".filter-type").value,
    value: li.querySelector(".filter-value").value,
  }));

  const titleRegexRules = Array.from(titleRegexList.children).map((li) => {
    const type = li.querySelector(".regex-or-text").value;
    if (type === "regex") {
      return {
        type: "regex",
        field: li.querySelector(".regex-field").value,
        pattern: li.querySelector(".regex-pattern").value,
      };
    } else if (type === "static") {
      return {
        type: "static",
        value: li.querySelector(".static-value").value,
      };
    }
  });

  const episodeRegex = document.getElementById("episodeRegex").value;
  const seasonRegex = document.getElementById("seasonRegex").value;
  const matchingStrategy = document.getElementById("matchingStrategy").value;

  try {
    const res = await fetch(`${API_BASE}/rulesets.php`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: currentRulesetId, // Include the ID if editing
        mediaId: currentMediaId,
        topic,
        priority,
        filters,
        titleRegexRules,
        episodeRegex,
        seasonRegex,
        matchingStrategy,
      }),
    });

    if (!res.ok) throw new Error("Failed to save ruleset");

    alert("Ruleset saved successfully!");
    loadRulesets(currentMediaId); // Refresh the list of rulesets
    resetRulesetForm(); // Clear the form after saving
  } catch (err) {
    alert(err.message);
  }
});

function resetRulesetForm() {
  currentRulesetId = null; // Reset the current ruleset ID
  document.getElementById("ruleset-topic").value = "";
  document.getElementById("ruleset-priority").value = "";
  filterList.innerHTML = "";
  titleRegexList.innerHTML = "";
  document.getElementById("episodeRegex").value = "";
  document.getElementById("seasonRegex").value = "";
  document.getElementById("matchingStrategy").value = "";
}



// Update Filters JSON View
function updateFiltersJSONView() {
  const filters = Array.from(filterList.children).map((li) => ({
    attribute: li.querySelector(".filter-attribute").value,
    type: li.querySelector(".filter-type").value,
    value: li.querySelector(".filter-value").value,
  }));

  document.getElementById("filtersJSON").textContent = JSON.stringify(filters, null, 2);
}

// Update Title Regex JSON View
function updateTitleRegexJSONView() {
  const titleRegexRules = Array.from(titleRegexList.children).map((li) => ({
    field: li.querySelector(".regex-field").value,
    pattern: li.querySelector(".regex-pattern").value,
  }));

  document.getElementById("titleRegexRulesJSON").textContent = JSON.stringify(titleRegexRules, null, 2);
}

// Trigger JSON updates when filters are edited
filterList.addEventListener("change", updateFiltersJSONView);
filterList.addEventListener("input", updateFiltersJSONView);

// Trigger JSON updates when title regex rules are edited
titleRegexList.addEventListener("change", updateTitleRegexJSONView);
titleRegexList.addEventListener("input", updateTitleRegexJSONView);


// Add Media
mediaForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("media-name").value;
  const type = document.getElementById("media-type").value;
  const tmdbId = document.getElementById("media-tmdbId").value;
  const imdbId = document.getElementById("media-imdbId").value;
  const tvdbId = document.getElementById("media-tvdbId").value;

  try {
    const res = await fetch(`${API_BASE}/media.php`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, type, tmdbId, imdbId, tvdbId }),
    });

    if (!res.ok) throw new Error("Failed to add media");
    alert("Media added successfully!");
    loadMedia();
  } catch (err) {
    alert(err.message);
  }
});

// Add Title Regex Rule or Static Text
addTitleRegexButton.addEventListener("click", () => {
  const li = document.createElement("li");

  li.innerHTML = `
    <select class="regex-or-text">
      <option value="regex">Regex Rule</option>
      <option value="static">Static Text</option>
    </select>
    <div class="regex-rule hidden">
      <select class="regex-field">
        <option value="title">Title</option>
        <option value="description">Description</option>
      </select>
      <input type="text" class="regex-pattern" placeholder="Regex Pattern">
    </div>
    <div class="static-text hidden">
      <input type="text" class="static-value" placeholder="Static Text">
    </div>
    <button type="button" class="remove-title-regex">Remove</button>
  `;

  const typeSelector = li.querySelector(".regex-or-text");
  const regexRuleSection = li.querySelector(".regex-rule");
  const staticTextSection = li.querySelector(".static-text");

  // Toggle between Regex Rule and Static Text inputs
  typeSelector.addEventListener("change", (e) => {
    const value = e.target.value;
    if (value === "regex") {
      regexRuleSection.classList.remove("hidden");
      staticTextSection.classList.add("hidden");
    } else {
      regexRuleSection.classList.add("hidden");
      staticTextSection.classList.remove("hidden");
    }
  });

  // Initialize the correct section based on the default value
  typeSelector.dispatchEvent(new Event("change"));

  // Remove this step
  li.querySelector(".remove-title-regex").addEventListener("click", () => {
    li.remove();
    updateTitleRegexRulesJSON();
  });

  // Append the new step to the list
  titleRegexList.appendChild(li);

  // Update JSON whenever the inputs change
  li.addEventListener("input", updateTitleRegexRulesJSON);
});

function updateTitleRegexRulesJSON() {
  const titleRegexRules = Array.from(titleRegexList.children).map((li) => {
    const type = li.querySelector(".regex-or-text").value;
    if (type === "regex") {
      return {
        type: "regex",
        field: li.querySelector(".regex-field").value,
        pattern: li.querySelector(".regex-pattern").value,
      };
    } else if (type === "static") {
      return {
        type: "static",
        value: li.querySelector(".static-value").value,
      };
    }
  });

  // Update the JSON view
  titleRegexRulesJSON.textContent = JSON.stringify(titleRegexRules, null, 2);
}


// Trigger JSON updates when title regex rules are edited
titleRegexList.addEventListener("input", updateTitleRegexRulesJSON);


// Event Listener for Media Selection
mediaSelect.addEventListener("change", async (e) => {
  const selectedMediaId = e.target.value;

  if (selectedMediaId) {
    currentMediaId = selectedMediaId;
    loadRulesets(selectedMediaId); // Load associated rulesets for the selected media
  }
});

// Load Rulesets for Selected Media
async function loadRulesets(mediaId) {
  try {
    const res = await fetch(`${API_BASE}/rulesets.php?mediaId=${mediaId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error("Failed to load rulesets");

    const rulesets = await res.json();
    rulesetSection.classList.remove("hidden");
    rulesetList.innerHTML = "";

    rulesets.forEach((ruleset) => {
      const li = document.createElement("li");
      li.innerHTML = `
        Topic: ${ruleset.topic}, Priority: ${ruleset.priority}
        <button class="edit-ruleset">Edit</button>
        <button class="delete-ruleset">Delete</button>
      `;

      // Edit button handler
      li.querySelector(".edit-ruleset").addEventListener("click", () => loadRulesetForEditing(ruleset));

      // Delete button handler
      li.querySelector(".delete-ruleset").addEventListener("click", async () => {
        if (confirm("Are you sure you want to delete this ruleset?")) {
          await deleteRuleset(ruleset.id);
          loadRulesets(mediaId); // Refresh rulesets list
        }
      });

      rulesetList.appendChild(li);
    });
  } catch (err) {
    alert(err.message);
  }
}

async function deleteRuleset(rulesetId) {
  try {
    const res = await fetch(`${API_BASE}/rulesets.php?id=${rulesetId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error("Failed to delete ruleset");
    alert("Ruleset deleted successfully!");
  } catch (err) {
    alert(err.message);
  }
}


// Add Filter
addFilterButton.addEventListener("click", () => {
  const li = document.createElement("li");

  // Create filter inputs dynamically
  li.innerHTML = `
    <select class="filter-attribute">
      <option value="channel">Channel</option>
      <option value="topic">Topic</option>
      <option value="title">Title</option>
      <option value="description">Description</option>
      <option value="duration">Duration</option>
      <option value="size">Size</option>
    </select>
    <select class="filter-type">
      <option value="ExactMatch">Exact Match</option>
      <option value="Contains">Contains</option>
      <option value="Regex">Regex</option>
      <option value="LowerThan">Lower Than</option>
      <option value="GreaterThan">Greater Than</option>
    </select>
    <input type="text" class="filter-value" placeholder="Value">
    <button type="button" class="remove-filter">Remove</button>
  `;

  // Add event listener for the "Remove" button inside the filter
  li.querySelector(".remove-filter").addEventListener("click", () => {
    li.remove();
  });

  // Append the created filter item to the filter list
  filterList.appendChild(li);
});


// Load Ruleset into Form for Editing
function loadRulesetForEditing(ruleset) {
  currentRulesetId = ruleset.id;
  // Populate basic ruleset information
  document.getElementById("ruleset-topic").value = ruleset.topic || "";
  document.getElementById("ruleset-priority").value = 
  ruleset.priority !== null && ruleset.priority !== undefined ? ruleset.priority : "";

  // Parse filters and populate Filters list
  filterList.innerHTML = "";
  const filters = JSON.parse(ruleset.filters || "[]"); // Parse filters string
  filters.forEach((filter) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <select class="filter-attribute">
        <option value="channel" ${filter.attribute === "channel" ? "selected" : ""}>Channel</option>
        <option value="topic" ${filter.attribute === "topic" ? "selected" : ""}>Topic</option>
        <option value="title" ${filter.attribute === "title" ? "selected" : ""}>Title</option>
        <option value="description" ${filter.attribute === "description" ? "selected" : ""}>Description</option>
        <option value="duration" ${filter.attribute === "duration" ? "selected" : ""}>Duration</option>
        <option value="size" ${filter.attribute === "size" ? "selected" : ""}>Size</option>
      </select>
      <select class="filter-type">
        <option value="ExactMatch" ${filter.type === "ExactMatch" ? "selected" : ""}>Exact Match</option>
        <option value="Contains" ${filter.type === "Contains" ? "selected" : ""}>Contains</option>
        <option value="Regex" ${filter.type === "Regex" ? "selected" : ""}>Regex</option>
        <option value="LowerThan" ${filter.type === "LowerThan" ? "selected" : ""}>Lower Than</option>
        <option value="GreaterThan" ${filter.type === "GreaterThan" ? "selected" : ""}>Greater Than</option>
      </select>
      <input type="text" class="filter-value" value="${filter.value || ""}">
      <button type="button" class="remove-filter">Remove</button>
    `;
    li.querySelector(".remove-filter").addEventListener("click", () => li.remove());
    filterList.appendChild(li);
  });

  // Parse titleRegexRules and populate Title Regex Rules list
  titleRegexList.innerHTML = "";
  const titleRegexRules = JSON.parse(ruleset.titleRegexRules || "[]"); // Parse titleRegexRules string
  titleRegexRules.forEach((regexRule) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <select class="regex-or-text">
        <option value="regex" ${regexRule.type === "regex" ? "selected" : ""}>Regex Rule</option>
        <option value="static" ${regexRule.type === "static" ? "selected" : ""}>Static Text</option>
      </select>
      <div class="regex-rule ${regexRule.type === "regex" ? "" : "hidden"}">
        <select class="regex-field">
          <option value="title" ${regexRule.field === "title" ? "selected" : ""}>Title</option>
          <option value="description" ${regexRule.field === "description" ? "selected" : ""}>Description</option>
        </select>
        <input type="text" class="regex-pattern" value="${regexRule.pattern || ""}">
      </div>
      <div class="static-text ${regexRule.type === "static" ? "" : "hidden"}">
        <input type="text" class="static-value" value="${regexRule.value || ""}">
      </div>
      <button type="button" class="remove-title-regex">Remove</button>
    `;

    const typeSelector = li.querySelector(".regex-or-text");
    const regexRuleSection = li.querySelector(".regex-rule");
    const staticTextSection = li.querySelector(".static-text");

    typeSelector.addEventListener("change", (e) => {
      if (e.target.value === "regex") {
        regexRuleSection.classList.remove("hidden");
        staticTextSection.classList.add("hidden");
      } else {
        regexRuleSection.classList.add("hidden");
        staticTextSection.classList.remove("hidden");
      }
    });

    li.querySelector(".remove-title-regex").addEventListener("click", () => li.remove());
    titleRegexList.appendChild(li);
  });

  // Populate other regex and strategy fields
  document.getElementById("episodeRegex").value = ruleset.episodeRegex || "";
  document.getElementById("seasonRegex").value = ruleset.seasonRegex || "";
  document.getElementById("matchingStrategy").value = ruleset.matchingStrategy || "";
  updateTitleRegexRulesJSON();
  updateFiltersJSONView();
}
