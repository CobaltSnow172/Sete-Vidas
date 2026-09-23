/* ==========================================================================
   "Antes de adotar" — checklist do enxoval.
   As marcações ficam salvas só neste navegador.
   ========================================================================== */

const CHECKLIST_KEY = "sete-vidas-enxoval-v1";

function initChecklist() {
  const list = document.getElementById("enxoval");
  if (!list) return;
  const boxes = [...list.querySelectorAll("input[type=checkbox]")];
  const bar = document.getElementById("enxoval-bar");
  const out = document.getElementById("enxoval-count");
  const readyMsg = document.getElementById("enxoval-ready");

  let saved = [];
  try { saved = JSON.parse(localStorage.getItem(CHECKLIST_KEY) || "[]"); } catch {}
  boxes.forEach((b) => (b.checked = saved.includes(b.value)));

  function update() {
    const done = boxes.filter((b) => b.checked);
    bar.style.setProperty("--p", done.length / boxes.length);
    out.textContent = `${done.length} de ${boxes.length} prontos`;
    readyMsg.hidden = done.length !== boxes.length;
    try { localStorage.setItem(CHECKLIST_KEY, JSON.stringify(done.map((b) => b.value))); } catch {}
  }

  list.addEventListener("change", update);
  update();
}

initChecklist();
