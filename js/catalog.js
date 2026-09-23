/* ==========================================================================
   Painel do topo (destaque da semana), grade de gatos, filtros e ordenação.
   ========================================================================== */

// Destaque da semana: alterna entre os três que esperam há mais tempo
function featuredCat() {
  const byWait = [...CATS].sort((a, b) => daysWaiting(b) - daysWaiting(a)).slice(0, 3);
  const week = Math.floor(Date.now() / (7 * 864e5));
  return byWait[week % byWait.length];
}

function renderScanner(cat) {
  document.getElementById("scanner").innerHTML = `
    <span class="featured mono">Destaque da semana</span>
    ${photoBox(cat, "hero")}
    <div class="readouts mono">
      <div>Nome<b>${cat.name}</b></div>
      <div>Esperando<b>${waitLabel(cat)}</b></div>
      <div>FIV/FeLV<b class="ok">Negativo</b></div>
    </div>
    <button class="btn btn-ghost btn-sm scanner-cta" type="button" data-open="${cat.id}">Conhecer ${cat.sex === "fêmea" ? "a" : "o"} ${cat.name}</button>`;
}

const ICON_YES = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_NO = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

// Lista "convive com": ✓ / ✕ para crianças, cães e gatos
function compatList(c, cls = "compat") {
  return `<ul class="${cls}" aria-label="Convivência">${COMPAT.map((k) => `
    <li class="${c[k.key] ? "yes" : "no"}">${c[k.key] ? ICON_YES : ICON_NO}<span>${k.short}</span><span class="sr-only">: ${c[k.key] ? "sim" : "não"}</span></li>`).join("")}
  </ul>`;
}

function renderGrid() {
  const grid = document.getElementById("grid");
  grid.innerHTML = CATS.map((c) => `
    <article class="card" data-id="${c.id}" data-group="${c.group}">
      <div class="card-inner">
        ${photoBox(c, "g-" + c.id)}
        ${LONGEST_WAIT.includes(c.id) ? `<span class="wait-badge mono">Espera longa</span>` : ""}
        <div class="card-body">
          <div><span class="mono">${c.code} · ${GROUP_LABEL[c.group]}</span><h3>${c.name}</h3></div>
          <p class="blurb">${c.blurb}</p>
          <div class="tags"><span class="tag">${c.sex} · ${c.age}</span>${c.traits.map((t) => `<span class="tag trait">${t}</span>`).join("")}</div>
          ${compatList(c)}
          <p class="wait mono">No lar temporário ${waitLabel(c)}</p>
          <button class="btn btn-primary" type="button" data-open="${c.id}">Quero conhecer</button>
        </div>
      </div>
    </article>`).join("");
}

// ---------- Filtros: idade + convivência + ordenação ----------

const filterState = { age: "todos", need: new Set(), sort: "abrigo" };

function countFor(key) {
  return key === "todos" ? CATS.length : CATS.filter((c) => c.group === key).length;
}

function applyFilter() {
  const grid = document.getElementById("grid");
  const { age, need, sort } = filterState;
  const order = sort === "espera" ? [...CATS].sort((a, b) => daysWaiting(b) - daysWaiting(a)) : CATS;

  let visible = 0;
  order.forEach((c) => {
    const card = grid.querySelector(`[data-id="${c.id}"]`);
    grid.append(card); // reordena sem recriar (mantém fotos carregadas)
    const show = (age === "todos" || c.group === age) && [...need].every((k) => c[k]);
    card.hidden = !show;
    // Índice da escalonagem, limitado para o último card não chegar atrasado
    if (show) card.style.setProperty("--i", Math.min(visible++, 6));
  });

  document.getElementById("count").textContent =
    `${visible} ${visible === 1 ? "gato disponível" : "gatos disponíveis"}`;
  document.getElementById("empty").hidden = visible > 0;
}

function initFilter() {
  const options = FILTERS.map((f) => ({ ...f, note: countFor(f.key) }));
  createSegmented(document.getElementById("seg"), options, "todos", (key) => {
    filterState.age = key;
    applyFilter();
  });

  const box = document.getElementById("filters");
  box.innerHTML = `
    <div class="chips" role="group" aria-label="Precisa conviver com">
      <span class="mono">Precisa conviver com</span>
      ${COMPAT.map((k) => `<button class="chip-toggle" type="button" data-need="${k.key}" aria-pressed="false">${k.short}</button>`).join("")}
    </div>
    <label class="sort mono">Ordenar
      <select id="sort">
        <option value="abrigo">Ordem do abrigo</option>
        <option value="espera">Esperando há mais tempo</option>
      </select>
    </label>`;

  box.addEventListener("click", (e) => {
    const b = e.target.closest("[data-need]");
    if (!b) return;
    const on = b.getAttribute("aria-pressed") !== "true";
    b.setAttribute("aria-pressed", String(on));
    on ? filterState.need.add(b.dataset.need) : filterState.need.delete(b.dataset.need);
    applyFilter();
  });
  box.querySelector("#sort").addEventListener("change", (e) => {
    filterState.sort = e.target.value;
    applyFilter();
  });
  document.getElementById("empty-reset").addEventListener("click", () => {
    filterState.need.clear();
    box.querySelectorAll("[data-need]").forEach((b) => b.setAttribute("aria-pressed", "false"));
    document.querySelector('#seg button[data-key="todos"]').click();
    applyFilter();
  });
}
