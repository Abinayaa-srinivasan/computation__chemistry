// DermaLens frontend (milestone 2): plain JavaScript, no build step.
// All text from the API is inserted with textContent (never innerHTML), so data cannot inject HTML.

const $ = (sel) => document.querySelector(sel);
const main = $("#main");
const drawer = $("#drawer");

const CATEGORY_ICONS = {
  lipstick: "💄", foundation: "🧴", moisturiser: "🫙", sunscreen: "☀️",
  serum: "💧", cleanser: "🫧", shampoo: "🧴", mascara: "👁️",
};
const icon = (c) => CATEGORY_ICONS[c] || "✨";
const money = (v) => (v == null ? "n/a" : "₹" + Math.round(v));
const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Tiny element helper: h("div", {class:"x"}, "text", childElement)
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

async function api(path) {
  const r = await fetch("/api" + path);
  if (!r.ok) throw new Error(r.status === 404 ? "Not found" : "Server error " + r.status);
  return r.json();
}

// ---- tiny localStorage wrapper (liked / avoided ingredients), safe if storage is blocked ----
const store = {
  get(key) { try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; } },
  set(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ } },
};
function toggleList(key, name) {
  const list = store.get(key);
  const i = list.indexOf(name);
  if (i >= 0) list.splice(i, 1); else list.push(name);
  store.set(key, list);
  return i < 0;
}

// ---- safety helpers ----
function safetyLevel(ing) {
  if (!ing.recognised && ing.recognised !== undefined) return "unk";
  if (ing.irritancy >= 3) return "bad";
  if (ing.irritancy === 2 || (ing.flags || []).some((f) => ["fragrance", "sensitive_caution", "pregnancy_caution"].includes(f))) return "warn";
  return "good";
}
const LEVEL_TEXT = { good: "Low concern", warn: "Some caution", bad: "Higher irritation potential", unk: "Not in our database" };
const dot = (lvl) => h("span", { class: "dot " + (lvl === "good" ? "" : lvl), title: LEVEL_TEXT[lvl], "aria-label": LEVEL_TEXT[lvl] });

const FLAG_TEXT = {
  allergen: "Common allergen", fragrance: "Fragrance", drying_alcohol: "Drying alcohol", paraben: "Paraben",
  sulfate: "Sulfate", essential_oil: "Essential oil", silicone: "Silicone",
  pregnancy_caution: "Check with doctor if pregnant", sensitive_caution: "Can irritate sensitive skin",
};

// ---- ingredient drawer ----
function openDrawer(ing, trigger) {
  drawer.replaceChildren();
  const close = h("button", { class: "btn secondary close", onclick: () => closeDrawer(trigger) }, "Close");
  drawer.append(close, h("h3", {}, ing.inci_name || ing.raw_name));
  if (ing.recognised === false) {
    drawer.append(h("p", {}, "We don't have this ingredient in our database yet."));
  } else {
    if (ing.aliases?.length) drawer.append(h("p", { class: "note" }, "Also called: " + ing.aliases.join(", ")));
    drawer.append(h("div", { class: "chips" }, (ing.categories || []).map((c) => h("span", { class: "badge" }, c))));
    drawer.append(h("p", {}, ing.description));
    const lvl = safetyLevel(ing);
    drawer.append(h("p", {}, dot(lvl), " ", LEVEL_TEXT[lvl], ` (irritation ${ing.irritancy}/5, pore-clogging ${ing.comedogenic}/5, rough educational estimates)`));
    if (ing.flags?.length) drawer.append(h("div", { class: "tags" }, ing.flags.map((f) => h("span", { class: "tag warn" }, FLAG_TEXT[f] || f))));
    if (ing.skin_types?.length) drawer.append(h("p", {}, h("strong", {}, "Suited to: "), ing.skin_types.join(", ")));
    if (ing.incompatible_with?.length) drawer.append(h("p", {}, h("strong", {}, "Avoid combining with: "), ing.incompatible_with.join(", ")));
    if (ing.typical_min != null) {
      drawer.append(h("p", {}, h("strong", {}, "Typical range: "), `${ing.typical_min}% to ${ing.typical_max}%`),
        h("p", { class: "note" }, "Typical range only, not the exact amount in this product. " + (ing.range_source || "")));
    }
    const liked = () => store.get("liked").includes(ing.inci_name);
    const avoided = () => store.get("avoided").includes(ing.inci_name);
    const likeBtn = h("button", { class: "btn secondary" }, "");
    const avoidBtn = h("button", { class: "btn secondary" }, "");
    const refresh = () => { likeBtn.textContent = liked() ? "♥ Liked" : "♡ Like"; avoidBtn.textContent = avoided() ? "⊘ Avoiding" : "Avoid"; };
    likeBtn.onclick = () => { toggleList("liked", ing.inci_name); refresh(); };
    avoidBtn.onclick = () => { toggleList("avoided", ing.inci_name); refresh(); };
    refresh();
    drawer.append(h("div", { class: "filters" }, likeBtn, avoidBtn),
      h("p", { class: "note" }, "Likes are saved in this browser only until accounts are added."));
  }
  drawer.hidden = false;
  close.focus();
}
function closeDrawer(trigger) { drawer.hidden = true; if (trigger) trigger.focus(); }
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !drawer.hidden) closeDrawer(); });

// ---- shared UI pieces ----
function productCard(p) {
  return h("a", { class: "card", href: "#/product/" + p.id },
    h("div", { class: "thumb", "aria-hidden": "true" }, icon(p.category)),
    h("strong", {}, p.name), h("span", { class: "brand-name" }, p.brand),
    h("span", {}, h("span", { class: "badge" }, p.category), " ", h("span", { class: "price" }, money(p.price))));
}
const skeleton = () => h("div", {}, h("div", { class: "skeleton" }), h("br"), h("div", { class: "skeleton" }));
const errorBox = (msg) => h("div", { class: "empty" }, "Something went wrong: " + msg + ". Is the server running?");

// ---- pages ----
async function homePage() {
  main.replaceChildren(
    h("section", { class: "hero" },
      h("h1", {}, "Know what's in your skincare"),
      h("p", { class: "lead" }, "Search a product or brand to see its ingredients, prices and where to buy, or browse by product type."),
      h("form", { class: "quick-analyze", onsubmit: (e) => { e.preventDefault(); pendingText = e.target.elements.q.value.trim(); location.hash = "#/analyze"; } },
        h("input", { name: "q", type: "text", placeholder: "Paste an ingredient list to check it…", "aria-label": "Paste an ingredient list" }),
        h("button", { class: "btn", type: "submit" }, "Analyze")),
      h("div", { class: "actions" },
        h("a", { class: "btn secondary", href: "#/analyze" }, "Scan or upload a label"),
        h("a", { class: "btn secondary", href: "#/ingredients" }, "Browse ingredients"))),
    h("h2", {}, "Browse by product type"), h("div", { id: "cats" }, skeleton()),
    h("h2", {}, "Find ingredients for your skin concern"),
    h("div", { class: "chips" }, [["pigmentation", "Pigmentation"], ["acne", "Acne"], ["dryness", "Dryness"], ["ageing", "Fine lines"],
      ["dark circles", "Dark circles"], ["redness", "Redness"], ["oiliness", "Oily skin"], ["dullness", "Dullness"],
      ["large pores", "Large pores"], ["sensitivity", "Sensitive skin"]].map(([k, t]) =>
      h("a", { class: "btn secondary", href: "#/concerns?c=" + encodeURIComponent(k) }, t))));
  try {
    const { categories } = await api("/categories");
    $("#cats").replaceChildren(h("div", { class: "grid" }, categories.map((c) =>
      h("a", { class: "tile", href: "#/category/" + c.name },
        h("span", { class: "emoji", "aria-hidden": "true" }, icon(c.name)),
        h("strong", {}, titleCase(c.name)), h("small", {}, c.product_count + " products")))));
  } catch (e) { $("#cats").replaceChildren(errorBox(e.message)); }
}

async function categoryPage(name) {
  main.replaceChildren(skeleton());
  try {
    const d = await api("/categories/" + encodeURIComponent(name));
    main.replaceChildren(
      h("div", { class: "crumbs" }, h("a", { href: "#/" }, "Home"), " / ", titleCase(name)),
      h("h1", {}, icon(name) + " " + titleCase(name) + ": basic ingredients"),
      h("p", { class: "lead" }, "The main ingredients found in most " + name + " formulas, with typical concentration ranges."),
      h("div", { class: "table-wrap" }, h("table", {},
        h("thead", {}, h("tr", {}, ["Ingredient", "Role in this product", "Typical min %", "Typical max %", "Why it is used"].map((t) => h("th", {}, t)))),
        h("tbody", {}, d.basic_ingredients.map((b) => h("tr", {},
          h("td", {}, h("a", { href: "#/ingredient/" + b.id }, b.inci_name)), h("td", {}, b.role),
          h("td", {}, b.typical_min), h("td", {}, b.typical_max), h("td", {}, b.why)))))),
      h("p", { class: "note" }, d.range_note + " Approximate sample values."),
      h("h2", {}, "Products"), h("div", { class: "cards" }, d.products.map(productCard)));
  } catch (e) { main.replaceChildren(errorBox(e.message)); }
}

function keyGroups(ings) {
  const wanted = ["Exfoliant", "Retinoid", "Brightening agent", "Antioxidant", "Peptide", "UV filter", "Humectant", "Soothing agent", "Skin-identical lipid", "Emollient", "Occlusive"];
  const groups = [];
  for (const g of wanted) {
    const names = ings.filter((i) => i.recognised && i.categories.includes(g)).map((i) => i.inci_name);
    if (names.length) groups.push([g, names]);
  }
  return groups;
}

function productTags(ings) {
  const has = (flag) => ings.some((i) => (i.flags || []).includes(flag));
  const tags = [];
  const add = (cls, text) => tags.push(h("span", { class: "tag " + cls }, text));
  has("fragrance") ? add("warn", "Contains fragrance") : add("good", "Fragrance-free");
  has("essential_oil") ? add("warn", "Contains essential oils") : add("good", "No essential oils");
  has("drying_alcohol") ? add("warn", "Contains drying alcohol") : add("good", "No drying alcohol");
  has("sulfate") ? add("warn", "Contains sulfates") : add("good", "Sulfate-free");
  has("paraben") ? add("warn", "Contains parabens") : add("good", "Paraben-free");
  has("silicone") ? add("warn", "Contains silicones") : add("good", "Silicone-free");
  if (has("allergen")) add("warn", "Contains common allergens");
  if (has("pregnancy_caution")) add("bad", "Pregnancy caution");
  return tags;
}

function safetySummary(ings) {
  const rec = ings.filter((i) => i.recognised);
  const high = rec.filter((i) => safetyLevel(i) === "bad");
  const caution = rec.filter((i) => safetyLevel(i) === "warn");
  const unknown = ings.length - rec.length;
  let verdict = "Generally low concern", cls = "good";
  if (high.length || rec.some((i) => i.flags.includes("pregnancy_caution"))) { verdict = "Use with caution"; cls = "bad"; }
  else if (caution.length) { verdict = "Some ingredients need care"; cls = "warn"; }
  return h("div", { class: "panel" },
    h("span", { class: "tag " + cls }, verdict),
    h("p", {}, `${rec.length} of ${ings.length} ingredients recognised. ` +
      (high.length ? "Higher irritation potential: " + high.map((i) => i.inci_name).join(", ") + ". " : "") +
      (caution.length ? "Worth noting: " + caution.map((i) => i.inci_name).join(", ") + ". " : "") +
      (unknown ? unknown + " not in our database." : "")),
    h("p", { class: "note" }, "A basic rule-based summary for learning, not medical advice. The full AI analyzer comes in a later milestone."));
}

async function productPage(id) {
  main.replaceChildren(skeleton());
  try {
    const p = await api("/products/" + id);
    const ings = p.ingredients;
    const groups = keyGroups(ings);
    main.replaceChildren(
      h("div", { class: "crumbs" }, h("a", { href: "#/" }, "Home"), " / ", h("a", { href: "#/category/" + p.category }, titleCase(p.category)), " / ", p.name),
      h("div", { class: "product-head" },
        h("div", { class: "thumb", "aria-hidden": "true" }, icon(p.category)),
        h("div", {}, h("h1", {}, p.name),
          h("p", { class: "lead" }, p.brand + (p.size ? " · " + p.size : "")),
          h("span", { class: "badge" }, p.category), " ", p.is_sample_data && h("span", { class: "badge sample", title: "Fictional demo data" }, "sample data"),
          h("p", {}, h("span", { class: "price" }, money(p.price)), " approx."),
          h("div", { class: "filters" },
            h("a", { class: "btn secondary", href: "#/dupes?id=" + p.id }, "Find dupes"),
            h("a", { class: "btn secondary", href: "#/compare?a=" + p.id }, "Compare"),
            h("button", { class: "btn secondary disabled", disabled: "", title: "Coming in a later milestone" }, "Add to routine")))),
      h("h2", {}, "What's inside"), h("div", { class: "tags" }, productTags(ings)),
      safetySummary(ings),
      groups.length > 0 && h("div", {}, h("h2", {}, "Key ingredient groups"),
        h("div", { class: "panel" }, groups.map(([g, names]) => h("p", {}, h("strong", {}, g + ": "), names.join(", "))))),
      h("h2", {}, "Ingredient list (label order)"),
      h("p", { class: "note" }, "Listed from highest to lowest amount. Click an ingredient for details."),
      h("div", { class: "panel" }, h("ol", { class: "ing-list", style: "list-style:none" }, ings.map((i) => {
        const btn = h("button", { class: "chip-btn", onclick: () => openDrawer(i, btn) },
          h("span", { class: "n" }, i.position), dot(safetyLevel(i)), i.inci_name || i.raw_name,
          (i.categories || []).length ? h("span", { class: "note" }, " · " + i.categories[0]) : null);
        return h("li", {}, btn);
      }))),
      h("h2", {}, "Where to buy"),
      h("div", { class: "table-wrap" }, h("table", {},
        h("thead", {}, h("tr", {}, ["Retailer", "Price", ""].map((t) => h("th", {}, t)))),
        h("tbody", {}, p.where_to_buy.map((l) => h("tr", {},
          h("td", {}, l.retailer), h("td", {}, money(l.price)),
          h("td", {}, h("a", { href: l.url, target: "_blank", rel: "noopener noreferrer" }, "Open retailer search")))))) ),
      h("p", { class: "note" }, p.cost_note + " DermaLens does not sell products."));
    document.title = p.name + " | DermaLens";
  } catch (e) { main.replaceChildren(errorBox(e.message)); }
}

async function searchPage(q) {
  main.replaceChildren(h("h1", {}, `Results for "${q}"`), skeleton());
  try {
    const d = await api("/search?q=" + encodeURIComponent(q) + "&limit=50");
    main.replaceChildren(h("h1", {}, `Results for "${q}"`),
      d.brands.length > 0 && h("p", {}, "Brands: ", d.brands.map((b) => [h("a", { href: "#/search?q=" + encodeURIComponent(b) }, b), "  "])),
      d.products.length ? h("div", { class: "cards" }, d.products.map(productCard))
        : h("div", { class: "empty" }, "No products found. Try a brand, a product type like \"serum\", or a shorter word."));
  } catch (e) { main.replaceChildren(errorBox(e.message)); }
}

async function ingredientsPage() {
  const state = { q: "", cat: "" };
  const list = h("div", {});
  const q = h("input", { type: "search", placeholder: "Search ingredients…", "aria-label": "Search ingredients" });
  const sel = h("select", { "aria-label": "Filter by category" }, h("option", { value: "" }, "All categories"));
  main.replaceChildren(h("h1", {}, "Ingredient encyclopedia"),
    h("p", { class: "lead" }, "What each ingredient does and how cautious to be."), h("div", { class: "filters" }, q, sel), list);
  async function refresh() {
    list.replaceChildren(skeleton());
    try {
      const d = await api("/ingredients?q=" + encodeURIComponent(state.q) + (state.cat ? "&category=" + encodeURIComponent(state.cat) : ""));
      list.replaceChildren(h("p", { class: "note" }, d.ingredients.length + " ingredients"),
        d.ingredients.length ? h("div", { class: "table-wrap" }, h("table", {},
          h("thead", {}, h("tr", {}, ["Ingredient", "Categories", "What it does"].map((t) => h("th", {}, t)))),
          h("tbody", {}, d.ingredients.map((i) => {
            const link = h("a", { href: "#/ingredient/" + i.id, onclick: (e) => { e.preventDefault(); openDrawer({ ...i, recognised: true }, link); } }, i.inci_name);
            return h("tr", {}, h("td", {}, dot(safetyLevel({ ...i, recognised: true })), " ", link),
              h("td", {}, i.categories.join(", ")), h("td", {}, i.description));
          })))) : h("div", { class: "empty" }, "No ingredients match."));
    } catch (e) { list.replaceChildren(errorBox(e.message)); }
  }
  try {
    const { categories } = await api("/ingredient-categories");
    categories.forEach((c) => sel.append(h("option", { value: c.name }, c.name)));
  } catch { /* filter stays "All" */ }
  let t;
  q.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { state.q = q.value.trim(); refresh(); }, 250); });
  sel.addEventListener("change", () => { state.cat = sel.value; refresh(); });
  refresh();
}

async function ingredientDetail(id) {
  try { openDrawer({ ...(await api("/ingredients/" + id)), recognised: true }); } catch (e) { main.replaceChildren(errorBox(e.message)); }
  if (!main.firstChild) ingredientsPage();
}

function soonPage(name) {
  main.replaceChildren(h("div", { class: "empty" }, h("h1", {}, name), h("p", {}, "This feature is coming in a later milestone."),
    h("a", { class: "btn", href: "#/" }, "Back to home")));
}


// ---------------- Analyzer page ----------------
let pendingText = "";
const EXAMPLE = "Water, Glycerin, Niacinamide, Propanediol, Salicylic Acid, Retinol, Parfum, Phenoxyethanol, Sodium Cocoamphoacetate";
const LEVEL_WORD = { good: "Low concern", warn: "Some caution", bad: "Higher concern", unk: "Unknown" };

async function analyzerPage() {
  const ta = h("textarea", { id: "ing-text", rows: "6", placeholder: "Paste an ingredient list here, e.g. Water, Glycerin, Niacinamide…", "aria-label": "Ingredient list" });
  ta.value = pendingText; pendingText = "";
  const status = h("p", { class: "note", role: "status" });
  const results = h("div", { id: "results" });
  const preview = h("img", { class: "preview", alt: "Selected label photo", hidden: "" });
  const fileInput = h("input", { type: "file", accept: "image/png,image/jpeg,image/webp", hidden: "", "aria-label": "Upload a photo of the label" });
  const phoneInput = h("input", { type: "file", accept: "image/*", capture: "environment", hidden: "", "aria-label": "Take a photo of the label" });
  const video = h("video", { class: "preview", autoplay: "", playsinline: "", muted: "", hidden: "" });
  const camBar = h("div", { class: "filters", hidden: "" });
  let stream = null;

  const stopCamera = () => { if (stream) stream.getTracks().forEach((t) => t.stop()); stream = null; video.hidden = true; camBar.hidden = true; };

  async function readImage(blob) {
    stopCamera();
    preview.src = URL.createObjectURL(blob); preview.hidden = false;
    status.textContent = "Reading the label…";
    const fd = new FormData(); fd.append("image", blob, "label.jpg");
    try {
      const r = await fetch("/api/ocr", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) { status.textContent = d.error + (d.hint ? " " + d.hint : ""); return; }
      ta.value = d.text;
      status.textContent = d.text ? d.note : "No text found. Try a sharper, closer photo, or type the list.";
    } catch { status.textContent = "Could not reach the server."; }
  }
  fileInput.addEventListener("change", () => fileInput.files[0] && readImage(fileInput.files[0]));
  phoneInput.addEventListener("change", () => phoneInput.files[0] && readImage(phoneInput.files[0]));

  const drop = h("div", { class: "drop", tabindex: "0", role: "button", "aria-label": "Upload a photo: click or drop an image here",
    onclick: () => fileInput.click(), onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); } } },
    "📷 Drop a photo of the ingredient label here, or click to upload");
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); const f = e.dataTransfer.files[0]; if (f && f.type.startsWith("image/")) readImage(f); });

  const camBtn = h("button", { class: "btn secondary", type: "button", onclick: async () => {
    if (!navigator.mediaDevices?.getUserMedia) { phoneInput.click(); return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      video.srcObject = stream; video.hidden = false; camBar.hidden = false; preview.hidden = true;
    } catch { status.textContent = "Camera not available or permission denied. Try Upload instead."; }
  } }, "Use camera");
  const snap = h("button", { class: "btn", type: "button", onclick: () => {
    const c = document.createElement("canvas"); c.width = video.videoWidth || 640; c.height = video.videoHeight || 480;
    c.getContext("2d").drawImage(video, 0, 0, c.width, c.height);
    c.toBlob((b) => b && readImage(b), "image/jpeg", 0.92);
  } }, "Capture photo");
  camBar.append(snap, h("button", { class: "btn secondary", type: "button", onclick: stopCamera }, "Cancel"));

  const go = h("button", { class: "btn", type: "button", onclick: run }, "Analyze ingredients");
  async function run() {
    const text = ta.value.trim();
    if (!text) { status.textContent = "Paste or scan an ingredient list first."; ta.focus(); return; }
    go.disabled = true; status.textContent = "Analyzing…"; results.replaceChildren(skeleton());
    try {
      const r = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const d = await r.json();
      if (!r.ok) { status.textContent = d.error; results.replaceChildren(); }
      else { status.textContent = ""; renderAnalysis(results, d); results.scrollIntoView({ behavior: "smooth" }); }
    } catch { status.textContent = "Could not reach the server."; results.replaceChildren(); }
    go.disabled = false;
  }

  main.replaceChildren(
    h("h1", {}, "Ingredient Analyzer"),
    h("p", { class: "lead" }, "Check any skincare or makeup ingredient list for a science-backed breakdown: what each ingredient does and whether it is safe to use."),
    h("div", { class: "panel" }, ta,
      h("div", { class: "filters" }, go,
        h("button", { class: "btn secondary", type: "button", onclick: () => { ta.value = EXAMPLE; } }, "Try an example"),
        camBtn, h("button", { class: "btn secondary", type: "button", onclick: () => fileInput.click() }, "Upload photo"),
        h("button", { class: "btn secondary phone-only", type: "button", onclick: () => phoneInput.click() }, "Take photo (phone)")),
      drop, video, camBar, preview, fileInput, phoneInput, status),
    results);
  window.addEventListener("hashchange", stopCamera, { once: true });
  if (ta.value) run();
}

function renderAnalysis(root, d) {
  const v = d.verdict;
  const flagLabels = [["allergens", "Allergens", "warn"], ["irritants", "Irritants", "bad"], ["comedogenic", "May clog pores", "warn"],
    ["pregnancy_caution", "Pregnancy caution", "bad"], ["sensitive_skin_caution", "Sensitive-skin caution", "warn"], ["fragrance", "Fragrance / essential oils", "warn"]];
  const flagRows = flagLabels.filter(([k]) => d.flags[k].length);
  root.replaceChildren(...[
    h("div", { class: "panel verdict " + v.level },
      h("span", { class: "tag " + v.level }, v.label),
      h("p", {}, d.summary),
      h("ul", {}, v.reasons.map((r) => h("li", {}, r))),
      h("p", { class: "note" }, `${d.recognised_count} of ${d.total} ingredients recognised` + (d.fuzzy_count ? `, ${d.fuzzy_count} matched after correcting spelling` : "") + ".")),
    flagRows.length > 0 && h("div", {}, h("h2", {}, "Flags"),
      h("div", { class: "panel" }, flagRows.map(([k, label, cls]) => h("p", {}, h("span", { class: "tag " + cls }, label), " ", d.flags[k].join(", "))))),
    d.key_groups.length > 0 && h("div", {}, h("h2", {}, "What it does"),
      h("div", { class: "panel" }, d.key_groups.map((g) => h("p", {}, h("strong", {}, g.group + ": "), g.ingredients.join(", "))))),
    h("h2", {}, "Ingredient by ingredient (label order)"),
    h("div", { class: "table-wrap" }, h("table", {},
      h("thead", {}, h("tr", {}, ["#", "Ingredient", "Category", "Safety", "Why"].map((t) => h("th", {}, t)))),
      h("tbody", {}, d.ingredients.map((i) => h("tr", {},
        h("td", {}, i.position),
        h("td", {}, i.inci_name, i.match === "fuzzy" ? h("div", { class: "note" }, `read as "${i.raw_name}", matched approximately`) : null),
        h("td", {}, i.recognised ? h("span", { class: "chips" }, i.categories.map((c) => h("span", { class: "badge" }, c))) : (i.suggestion ? h("span", { class: "badge sample" }, "suggested: " + i.suggestion.category) : "")),
        h("td", {}, dot(i.level), " ", LEVEL_WORD[i.level]),
        h("td", {}, i.reason)))))),
    d.conflicts.length > 0 && h("div", {}, h("h2", {}, "Ingredients that clash"), h("div", { class: "panel" }, d.conflicts.map((c) => h("p", {}, "⚠️ " + c.message)))),
    d.unrecognised.length > 0 && h("div", {}, h("h2", {}, "Not recognised"),
      h("p", { class: "note" }, "Suggested categories come from keyword rules or a small ML model and are guesses. Low confidence means treat it as unknown."),
      h("div", { class: "panel" }, d.unrecognised.map((u) => h("p", {}, h("strong", {}, u.raw_name), " → ",
        u.suggestion ? `${u.suggestion.category} (${Math.round(u.suggestion.confidence * 100)}% confidence, ${u.suggestion.method})` + (u.suggestion.confidence < 0.5 ? " – low confidence" : "") : "no suggestion available")))),
    h("p", { class: "note" }, d.disclaimer)].filter(Boolean));
}


// ---------------- Skin concerns page ----------------
const PRIORITY_TEXT = { 3: "First-line", 2: "Good option", 1: "Supporting" };

async function openIngredientById(id, trigger) {
  try { openDrawer({ ...(await api("/ingredients/" + id)), recognised: true }, trigger); } catch { /* ignore */ }
}

async function concernsPage(query) {
  main.replaceChildren(skeleton());
  let meta;
  try { meta = await api("/concerns"); } catch (e) { main.replaceChildren(errorBox(e.message)); return; }
  const preset = (new URLSearchParams(query).get("c") || "").split(",").filter(Boolean);
  const results = h("div", { id: "results" });
  const status = h("p", { class: "note", role: "status" });

  const skin = h("select", { id: "skin", "aria-label": "Skin type" }, h("option", { value: "" }, "Not sure / skip"),
    meta.skin_types.map((t) => h("option", { value: t }, titleCase(t))));
  const concernBoxes = meta.concerns.map((c) => {
    const box = h("input", { type: "checkbox", value: c.name, id: "c-" + c.name });
    if (preset.includes(c.name)) box.checked = true;
    return h("label", { class: "check", title: c.description }, box, " " + c.label);
  });
  const avoidBoxes = meta.allergies.map((a) => h("label", { class: "check" }, h("input", { type: "checkbox", value: a.key }), " " + a.label));
  const avoidText = h("input", { type: "text", placeholder: "Other ingredients to avoid, e.g. Niacinamide, Lanolin", "aria-label": "Other ingredients to avoid", maxlength: "300" });
  const pregnant = h("input", { type: "checkbox", id: "pregnant" });
  const cat = h("select", { "aria-label": "Product type" }, meta.categories.map((c, i) => h("option", { value: i === 0 ? "" : c }, titleCase(c))));
  const price = h("input", { type: "number", min: "0", placeholder: "Max price ₹", "aria-label": "Maximum price in rupees" });
  const fragFree = h("input", { type: "checkbox", id: "ff" });

  const go = h("button", { class: "btn", type: "submit" }, "Get recommendations");
  const form = h("form", { class: "panel", onsubmit: async (e) => {
    e.preventDefault();
    const concerns = concernBoxes.map((l) => l.querySelector("input")).filter((i) => i.checked).map((i) => i.value);
    if (!concerns.length) { status.textContent = "Pick at least one concern."; return; }
    if (concerns.length > 4) { status.textContent = "Pick up to 4 concerns at a time."; return; }
    const body = { skin_type: skin.value, concerns, allergies: avoidBoxes.map((l) => l.querySelector("input")).filter((i) => i.checked).map((i) => i.value),
      avoid_text: avoidText.value.trim(), pregnant: pregnant.checked, category: cat.value, fragrance_free: fragFree.checked, max_price: price.value };
    go.disabled = true; status.textContent = "Finding the best ingredients…"; results.replaceChildren(skeleton());
    try {
      const r = await fetch("/api/recommend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) { status.textContent = d.error; results.replaceChildren(); }
      else { status.textContent = ""; renderRecommendations(results, d); results.scrollIntoView({ behavior: "smooth" }); }
    } catch { status.textContent = "Could not reach the server."; results.replaceChildren(); }
    go.disabled = false;
  } },
    h("h2", { style: "margin-top:0" }, "1. Your skin"), h("div", { class: "filters" }, h("label", {}, "Skin type ", skin)),
    h("h2", {}, "2. Your concerns (pick up to 4)"), h("div", { class: "checks" }, concernBoxes),
    h("h2", {}, "3. Things to avoid (optional)"), h("div", { class: "checks" }, avoidBoxes),
    h("div", { class: "filters" }, avoidText), h("label", { class: "check" }, pregnant, " I am pregnant or breastfeeding"),
    h("h2", {}, "4. Product filters (optional)"), h("div", { class: "filters" }, cat, price, h("label", { class: "check" }, fragFree, " Fragrance-free only")),
    h("div", { class: "filters" }, go), status);

  main.replaceChildren(h("h1", {}, "Ingredients for your skin concern"),
    h("p", { class: "lead" }, "Tell us your skin type and concerns. You get the ingredients that help most, how to use them, and products in our database that contain them."),
    form, results);
  if (preset.length) form.requestSubmit();
}

function renderRecommendations(root, d) {
  const blocks = [];
  for (const c of d.concerns) {
    blocks.push(h("h2", {}, c.label),
      h("p", { class: "lead" }, c.description),
      h("div", { class: "cards" }, c.ingredients.map((i) => {
        const btn = h("button", { class: "linklike", type: "button", onclick: () => openIngredientById(i.id, btn) }, i.inci_name);
        return h("div", { class: "card" },
          h("div", {}, btn, " ", h("span", { class: "badge" }, PRIORITY_TEXT[i.priority])),
          h("span", { class: "chips" }, i.categories.map((x) => h("span", { class: "badge" }, x))),
          h("p", {}, i.why), h("p", {}, h("strong", {}, "How to use: "), i.how_to_use),
          i.caution && h("p", {}, h("span", { class: "tag warn" }, "Caution"), " " + i.caution),
          i.skin_note && h("p", { class: "note" }, i.skin_note));
      })),
      c.avoid.length > 0 && h("div", { class: "panel" }, h("strong", {}, "Best to avoid"),
        h("ul", {}, c.avoid.map((a) => h("li", {}, h("strong", {}, a.item + ": "), a.why)))),
      c.tips.length > 0 && h("ul", {}, c.tips.map((t) => h("li", {}, t))));
  }
  blocks.push(h("h2", {}, "Putting it together"), h("div", { class: "panel" }, h("ul", {}, d.tips.map((t) => h("li", {}, t)))));
  if (d.excluded.length) blocks.push(h("div", { class: "panel" }, h("strong", {}, "Left out because of your choices"),
    h("ul", {}, d.excluded.map((x) => h("li", {}, x.inci_name + ": " + x.reason)))));
  if (d.unmatched_avoid.length) blocks.push(h("p", { class: "note" }, "We could not match these avoid-list names, so they were not applied: " + d.unmatched_avoid.join(", ") + "."));

  blocks.push(h("h2", {}, "Products with these ingredients"),
    h("p", { class: "note" }, d.scoring_note + " Showing " + d.products.length + " of " + d.product_count + " matches. Demo products only."));
  if (!d.products.length) blocks.push(h("div", { class: "empty" }, "No products matched your filters. Try removing a filter."));
  else blocks.push(h("div", { class: "cards" }, d.products.map((p) =>
    h("div", { class: "card" },
      h("a", { href: "#/product/" + p.id }, h("strong", {}, p.name)),
      h("span", { class: "brand-name" }, p.brand + " · " + titleCase(p.category) + " · " + money(p.price)),
      h("div", {}, h("span", { class: "tag good" }, "Score " + p.score)),
      h("div", { class: "chips" }, p.matched.map((m) => h("span", { class: "badge hit", title: "Helps with: " + m.concerns.join(", ") }, m.inci_name + " (#" + m.position + ")"))),
      p.warnings.map((w) => h("p", { class: "note" }, "⚠ " + w)),
      h("details", {}, h("summary", {}, "How this score is worked out"), h("ul", {}, p.breakdown.map((b) => h("li", {}, b))))))));
  blocks.push(h("p", { class: "note" }, d.disclaimer));
  root.replaceChildren(...blocks.filter(Boolean));
}


// ---------------- Compare page ----------------
async function productOptions() {
  const { products } = await api("/products");
  const byCat = {};
  products.forEach((p) => (byCat[p.category] ||= []).push(p));
  return Object.keys(byCat).sort().map((c) => h("optgroup", { label: titleCase(c) },
    byCat[c].map((p) => h("option", { value: p.id }, p.name + " (" + p.brand + ")"))));
}

function sidePicker(label, groups, presetId) {
  const sel = h("select", { "aria-label": "Product " + label }, h("option", { value: "" }, "Choose a product…"), groups.map((g) => g.cloneNode(true)));
  const ta = h("textarea", { rows: "5", placeholder: "Paste the ingredient list for product " + label + "…", "aria-label": "Ingredient list for product " + label, hidden: "" });
  const name = h("input", { type: "text", placeholder: "Optional name for product " + label, hidden: "", maxlength: "60", "aria-label": "Name of product " + label });
  const mode = { v: "product" };
  const r1 = h("input", { type: "radio", name: "mode" + label, checked: "" }), r2 = h("input", { type: "radio", name: "mode" + label });
  const setMode = (m) => { mode.v = m; sel.hidden = m !== "product"; ta.hidden = name.hidden = m !== "text"; };
  r1.addEventListener("change", () => setMode("product")); r2.addEventListener("change", () => setMode("text"));
  if (presetId) sel.value = String(presetId);
  const el = h("div", { class: "panel" }, h("h2", { style: "margin-top:0" }, "Product " + label),
    h("div", { class: "checks" }, h("label", { class: "check" }, r1, " From our database"), h("label", { class: "check" }, r2, " Paste ingredient list")),
    h("div", { class: "filters" }, sel, name), ta);
  return { el, get: () => mode.v === "product" ? { product_id: sel.value } : { text: ta.value, name: name.value.trim() } };
}

async function comparePage(query) {
  main.replaceChildren(skeleton());
  let groups;
  try { groups = await productOptions(); } catch (e) { main.replaceChildren(errorBox(e.message)); return; }
  const q = new URLSearchParams(query);
  const A = sidePicker("A", groups, q.get("a")), B = sidePicker("B", groups, q.get("b"));
  const status = h("p", { class: "note", role: "status" });
  const results = h("div", { id: "results" });
  const go = h("button", { class: "btn", type: "button", onclick: run }, "Compare products");
  async function run() {
    go.disabled = true; status.textContent = "Comparing…"; results.replaceChildren(skeleton());
    try {
      const r = await fetch("/api/compare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ a: A.get(), b: B.get() }) });
      const d = await r.json();
      if (!r.ok) { status.textContent = d.error; results.replaceChildren(); }
      else { status.textContent = ""; renderCompare(results, d); results.scrollIntoView({ behavior: "smooth" }); }
    } catch { status.textContent = "Could not reach the server."; results.replaceChildren(); }
    go.disabled = false;
  }
  main.replaceChildren(h("h1", {}, "Compare two products"),
    h("p", { class: "lead" }, "Pick two products or paste two ingredient lists. You get a verdict, the reasons, and which skin type each suits."),
    h("div", { class: "two" }, A.el, B.el), h("div", { class: "filters" }, go), status, results);
  if (q.get("a") && q.get("b")) run();
}

const bar = (v, cls) => h("div", { class: "bar", role: "img", "aria-label": v + " out of 100" }, h("div", { class: "fill " + cls, style: "width:" + Math.max(2, v) + "%" }));

function scoreCard(side, win) {
  const p = side.profile;
  return h("div", { class: "panel scorecard" + (win ? " winner" : "") },
    win && h("span", { class: "tag good" }, "Better overall"),
    h("h3", {}, side.title), side.brand && h("p", { class: "note" }, side.brand + (side.price ? " · ₹" + Math.round(side.price) : "")),
    h("div", { class: "big" }, p.overall, h("small", {}, " / 100")),
    h("p", { class: "note" }, "Safety " + p.safety), bar(p.safety, "good"),
    h("p", { class: "note" }, "Benefit " + p.benefit), bar(p.benefit, "brand"),
    h("p", {}, h("strong", {}, "Best for: "), p.best_for_skin.length ? p.best_for_skin.join(", ") + " skin" : "no skin type clearly"),
    p.helps_concerns.length > 0 && h("p", {}, h("strong", {}, "Helps with: "), p.helps_concerns.map((c) => c.label).join(", ")),
    p.penalties.length > 0 && h("details", {}, h("summary", {}, "Why it lost safety points (" + p.penalties.length + ")"),
      h("ul", {}, p.penalties.map((x) => h("li", {}, `${x.inci_name}: ${x.reason} (−${x.points})`)))),
    p.unknown.length > 0 && h("p", { class: "note" }, p.unknown.length + " not recognised: " + p.unknown.slice(0, 5).join(", ")));
}

function listCell(items) { return items.length ? h("ul", { class: "tight" }, items.map((x) => h("li", {}, x))) : h("span", { class: "note" }, "none"); }

function renderCompare(root, d) {
  const pa = d.a.profile, pb = d.b.profile;
  const row = (label, x, y) => h("tr", {}, h("th", { scope: "row" }, label), h("td", {}, String(x)), h("td", {}, String(y)));
  const cats = [...new Set([...Object.keys(pa.category_counts), ...Object.keys(pb.category_counts)])].sort();
  const cls = d.winner === "tie" ? "warn" : "good";
  const blocks = [
    h("div", { class: "panel verdict " + cls }, h("span", { class: "tag " + cls }, d.headline),
      h("p", { class: "note" }, "Score gap: " + Math.abs(d.score_gap) + " points"),
      h("ul", {}, d.reasons.map((r) => h("li", {}, r))),
      d.notes.map((n) => h("p", { class: "note" }, "ℹ " + n))),
    h("div", { class: "two" }, scoreCard(d.a, d.winner === "a"), scoreCard(d.b, d.winner === "b")),
    h("div", { class: "panel" }, d.choose.map((c) => h("p", {}, c))),
    h("h2", {}, "At a glance"),
    h("div", { class: "table-wrap" }, h("table", {}, h("thead", {}, h("tr", {}, h("th", {}, ""), h("th", {}, d.a.title), h("th", {}, d.b.title))),
      h("tbody", {}, row("Overall score", pa.overall, pb.overall), row("Safety score", pa.safety, pb.safety), row("Benefit score", pa.benefit, pb.benefit),
        row("Irritants (rating 3+)", pa.irritant_count, pb.irritant_count), row("Common allergens", pa.allergen_count, pb.allergen_count),
        row("Fragrance / essential oils", pa.fragrance_count, pb.fragrance_count),
        row("Pore-clogging ingredients (4+)", pa.comedogenic_high.length ? pa.comedogenic_high.join(", ") : "none", pb.comedogenic_high.length ? pb.comedogenic_high.join(", ") : "none"),
        row("Ingredients recognised", pa.recognised + " of " + pa.total, pb.recognised + " of " + pb.total)))),
    h("h2", {}, "Which skin types suit each"),
    h("div", { class: "table-wrap" }, h("table", {}, h("thead", {}, h("tr", {}, h("th", {}, "Skin type"), h("th", {}, d.a.title), h("th", {}, d.b.title))),
      h("tbody", {}, pa.skin_fit.map((f, i) => h("tr", {}, h("th", { scope: "row" }, titleCase(f.skin_type)),
        h("td", {}, h("span", { class: "tag " + (f.suitable ? "good" : "warn") }, f.suitable ? "Suitable" : "Less suitable"), h("div", { class: "note" }, f.reason)),
        h("td", {}, h("span", { class: "tag " + (pb.skin_fit[i].suitable ? "good" : "warn") }, pb.skin_fit[i].suitable ? "Suitable" : "Less suitable"), h("div", { class: "note" }, pb.skin_fit[i].reason))))))),
    h("h2", {}, "Ingredients"),
    h("div", { class: "table-wrap" }, h("table", {}, h("thead", {}, h("tr", {}, h("th", {}, "Only in " + d.a.title), h("th", {}, "In both"), h("th", {}, "Only in " + d.b.title))),
      h("tbody", {}, h("tr", {}, h("td", {}, listCell(d.only_a)), h("td", {}, listCell(d.shared)), h("td", {}, listCell(d.only_b)))))),
    h("h2", {}, "Ingredient categories"),
    h("div", { class: "table-wrap" }, h("table", {}, h("thead", {}, h("tr", {}, h("th", {}, "Category"), h("th", {}, d.a.title), h("th", {}, d.b.title))),
      h("tbody", {}, cats.map((c) => row(c, pa.category_counts[c] || 0, pb.category_counts[c] || 0))))),
    h("p", { class: "note" }, d.method), h("p", { class: "note" }, d.disclaimer)];
  root.replaceChildren(...blocks.filter(Boolean));
}

// ---------------- Dupes page ----------------
async function dupesPage(query) {
  main.replaceChildren(skeleton());
  let groups;
  try { groups = await productOptions(); } catch (e) { main.replaceChildren(errorBox(e.message)); return; }
  const q = new URLSearchParams(query);
  const sel = h("select", { "aria-label": "Product to find dupes for" }, h("option", { value: "" }, "Choose a product…"), groups);
  const cheaper = h("input", { type: "checkbox" });
  const results = h("div", { id: "results" });
  async function run() {
    if (!sel.value) { results.replaceChildren(h("div", { class: "empty" }, "Choose a product first.")); return; }
    results.replaceChildren(skeleton());
    try { renderDupes(results, await api("/products/" + sel.value + "/dupes" + (cheaper.checked ? "?cheaper=1" : ""))); }
    catch (e) { results.replaceChildren(errorBox(e.message)); }
  }
  sel.addEventListener("change", run); cheaper.addEventListener("change", () => sel.value && run());
  if (q.get("id")) sel.value = q.get("id");
  main.replaceChildren(h("h1", {}, "Dupe finder"),
    h("p", { class: "lead" }, "Find products with similar ingredients, ideally for less."),
    h("div", { class: "filters" }, sel, h("label", { class: "check" }, cheaper, " Cheaper only")), results);
  if (sel.value) run();
}

function renderDupes(root, d) {
  const blocks = [h("h2", {}, "Alternatives to " + d.product.name), h("p", { class: "note" }, d.product.brand + " · " + titleCase(d.product.category) + " · " + money(d.product.price))];
  if (!d.dupes.length) blocks.push(h("div", { class: "empty" }, "No similar products found (try turning off 'Cheaper only')."));
  else blocks.push(h("div", { class: "cards" }, d.dupes.map((x) => {
    const diff = x.price_difference;
    const priceText = diff == null ? "" : diff < 0 ? `₹${Math.abs(Math.round(diff))} cheaper (${Math.abs(x.price_difference_pct)}%)` : diff > 0 ? `₹${Math.round(diff)} more expensive` : "Same price";
    return h("div", { class: "card" },
      h("a", { href: "#/product/" + x.id }, h("strong", {}, x.name)),
      h("span", { class: "brand-name" }, x.brand + " · " + money(x.price)),
      h("div", {}, h("span", { class: "tag " + (x.similarity >= 60 ? "good" : "warn") }, x.similarity + "% similar")),
      priceText && h("p", { class: "price" }, priceText),
      h("p", { class: "note" }, `Ingredient match ${x.ingredient_match}% · Attribute match ${x.attribute_match}% · ${x.shared_count} shared ingredients`),
      x.missing_groups.length > 0 && h("p", {}, h("span", { class: "tag warn" }, "Missing"), " " + x.missing_groups.join(", ").toLowerCase() + " (in the original)"),
      x.shared_groups.length > 0 && h("p", { class: "note" }, "Both have: " + x.shared_groups.join(", ").toLowerCase()),
      h("details", {}, h("summary", {}, "Shared ingredients"), h("p", { class: "note" }, x.shared.join(", ") || "none")),
      h("a", { class: "btn secondary", href: `#/compare?a=${d.product.id}&b=${x.id}` }, "Compare"));
  })));
  blocks.push(h("p", { class: "note" }, d.method), h("p", { class: "note" }, d.note));
  root.replaceChildren(...blocks.filter(Boolean));
}

// ---- header search with debounced autocomplete ----
const searchBox = $("#search");
const suggest = $("#suggest");
let timer;
searchBox.addEventListener("input", () => {
  clearTimeout(timer);
  const q = searchBox.value.trim();
  if (q.length < 2) { suggest.hidden = true; return; }
  timer = setTimeout(async () => {
    try {
      const d = await api("/search?q=" + encodeURIComponent(q) + "&limit=6");
      suggest.replaceChildren(...d.products.map((p) => h("li", {}, h("a", { href: "#/product/" + p.id },
        h("span", { "aria-hidden": "true" }, icon(p.category)), h("span", {}, p.name, h("br"), h("small", {}, p.brand))))),
        ...d.brands.slice(0, 3).map((b) => h("li", {}, h("a", { href: "#/search?q=" + encodeURIComponent(b) }, "Brand: " + b))));
      suggest.hidden = !suggest.children.length;
    } catch { suggest.hidden = true; }
  }, 250);
});
searchBox.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && searchBox.value.trim()) { suggest.hidden = true; location.hash = "#/search?q=" + encodeURIComponent(searchBox.value.trim()); }
  if (e.key === "Escape") suggest.hidden = true;
});
document.addEventListener("click", (e) => { if (!e.target.closest(".search-wrap")) suggest.hidden = true; });
suggest.addEventListener("click", () => { suggest.hidden = true; });

// ---- router ----
function route() {
  const hash = location.hash.replace(/^#/, "") || "/";
  const [path, query = ""] = hash.split("?");
  const parts = path.split("/").filter(Boolean);
  drawer.hidden = true;
  document.title = "DermaLens: cosmetic ingredient classifier";
  window.scrollTo(0, 0);
  if (!parts.length) return homePage();
  if (parts[0] === "product") return productPage(parts[1]);
  if (parts[0] === "category") return categoryPage(decodeURIComponent(parts[1]));
  if (parts[0] === "search") return searchPage(new URLSearchParams(query).get("q") || "");
  if (parts[0] === "ingredients") return ingredientsPage();
  if (parts[0] === "ingredient") { main.replaceChildren(); return ingredientDetail(parts[1]); }
  if (parts[0] === "analyze") return analyzerPage();
  if (parts[0] === "concerns") return concernsPage(query);
  if (parts[0] === "compare") return comparePage(query);
  if (parts[0] === "dupes") return dupesPage(query);
  if (parts[0] === "soon") return soonPage(decodeURIComponent(parts[1] || "Feature"));
  main.replaceChildren(h("div", { class: "empty" }, "Page not found. ", h("a", { href: "#/" }, "Go home")));
}
window.addEventListener("hashchange", route);
route();
