/* ==========================================================================
   "Qual gato combina com a sua casa?" — 4 perguntas e um ranking.
   Usa o perfil de cada gato em js/data.js (energy, kids, dogs, cats, group).
   Convivência é eliminatória; energia e idade dão pontos.
   ========================================================================== */

const QUESTIONS = [
  { key: "people", title: "Quem mora com você?", options: [
    { value: "adultos", label: "Só adultos" },
    { value: "criancas", label: "Tem criança em casa" },
  ] },
  { key: "pets", title: "Já tem outros bichos?", options: [
    { value: "nenhum", label: "Nenhum" },
    { value: "gato", label: "Gato" },
    { value: "cao", label: "Cachorro" },
    { value: "ambos", label: "Gato e cachorro" },
  ] },
  { key: "energy", title: "Como é a casa num dia normal?", options: [
    { value: 1, label: "Tranquila", hint: "passo boa parte do dia fora ou gosto de silêncio" },
    { value: 2, label: "Meio-termo", hint: "um pouco de brincadeira, um pouco de sofá" },
    { value: 3, label: "Movimentada", hint: "quero um gato para brincar o dia todo" },
  ] },
  { key: "age", title: "Tem preferência de idade?", options: [
    { value: "filhote", label: "Filhote" },
    { value: "adulto", label: "Adulto" },
    { value: "idoso", label: "Idoso" },
    { value: "tanto", label: "Tanto faz" },
  ] },
];

const NEED_LABEL = { kids: "crianças", dogs: "cães", cats: "outros gatos" };

function needsFrom(a) {
  const n = [];
  if (a.people === "criancas") n.push("kids");
  if (a.pets === "gato" || a.pets === "ambos") n.push("cats");
  if (a.pets === "cao" || a.pets === "ambos") n.push("dogs");
  return n;
}

// 0–100: convivência 30 · ritmo 40 · idade 30
function scoreCat(c, a) {
  const needs = needsFrom(a);
  const missing = needs.filter((k) => !c[k]);
  if (missing.length) return { c, pct: 0, blocked: true, reasons: [] };

  const reasons = needs.map((k) => `Convive com ${NEED_LABEL[k]}`);
  const diff = Math.abs(c.energy - a.energy);
  let pts = 30 + (40 - diff * 20);
  if (diff === 0) reasons.push("Mesmo ritmo da sua casa");
  if (a.age === "tanto") pts += 30;
  else if (c.group === a.age) { pts += 30; reasons.push("A idade que você procura"); }
  else pts += 5;
  if (!reasons.length) reasons.push(`${c.traits[0][0].toUpperCase() + c.traits[0].slice(1)} e ${c.traits[1]}`);
  return { c, pct: Math.max(0, Math.min(100, pts)), blocked: false, reasons };
}

// Rótulo em vez de porcentagem: vários "100%" empatados passam menos confiança que uma faixa
function fitLabel(pct) {
  if (pct >= 85) return `<span class="fit">Combina muito</span>`;
  if (pct >= 60) return `<span class="fit mid">Combina bem</span>`;
  return `<span class="fit low">Pode combinar</span>`;
}

function initMatch() {
  const root = document.getElementById("match");
  if (!root) return;
  const answers = {};
  let step = 0;

  function intro() {
    root.innerHTML = `
      <div class="match-intro">
        <div>
          <p class="mono">4 perguntas · 30 segundos</p>
          <h2 class="section-title" id="match-h">Não sabe por onde começar?</h2>
          <p class="section-lede">Conte como é a sua casa e a gente mostra quem combina: convivência, ritmo e idade.</p>
        </div>
        <button class="btn btn-primary" type="button" data-start>Descobrir quem combina</button>
      </div>`;
  }

  function question() {
    const q = QUESTIONS[step];
    root.innerHTML = `
      <div class="match-q">
        <div class="match-top">
          <span class="mono">Pergunta ${step + 1} de ${QUESTIONS.length}</span>
          <div class="match-bar" aria-hidden="true"><i style="--p:${step / QUESTIONS.length}"></i></div>
        </div>
        <h3 id="match-h" tabindex="-1">${q.title}</h3>
        <div class="match-options" role="group" aria-labelledby="match-h">
          ${q.options.map((o) => `
            <button class="match-opt" type="button" data-value="${o.value}" aria-pressed="${answers[q.key] == o.value}">
              <b>${o.label}</b>${o.hint ? `<small>${o.hint}</small>` : ""}
            </button>`).join("")}
        </div>
        ${step ? `<button class="link-btn" type="button" data-back>← Voltar</button>` : ""}
      </div>`;
    root.querySelector("#match-h").focus({ preventScroll: true });
  }

  function results() {
    const ranked = CATS.map((c) => scoreCat(c, answers)).filter((r) => !r.blocked).sort((x, y) => y.pct - x.pct || daysWaiting(y.c) - daysWaiting(x.c));
    const top = ranked.slice(0, 3);
    const needs = needsFrom(answers);
    root.innerHTML = `
      <div class="match-result">
        <div class="match-top">
          <span class="mono">Resultado</span>
          <button class="link-btn" type="button" data-restart>Refazer</button>
        </div>
        <h3 id="match-h" tabindex="-1">${top.length ? "Quem mais combina com a sua casa" : "Nenhum gato daqui convive com tudo isso"}</h3>
        ${top.length ? `
          <div class="match-list">
            ${top.map((r, i) => `
              <article class="match" style="--i:${i}">
                ${photoBox(r.c, "mt-" + r.c.id)}
                <div class="match-body">
                  <div class="match-name"><h4>${r.c.name}</h4>${fitLabel(r.pct)}</div>
                  <span class="mono">${GROUP_LABEL[r.c.group]} · ${r.c.age} · esperando ${waitLabel(r.c)}</span>
                  <ul class="reasons">${r.reasons.map((t) => `<li>${t}</li>`).join("")}</ul>
                  <button class="btn btn-primary btn-sm" type="button" data-open="${r.c.id}">Ver ficha</button>
                </div>
              </article>`).join("")}
          </div>
          ${needs.length ? `<button class="link-btn" type="button" data-apply>Ver todos que convivem com ${needs.map((k) => NEED_LABEL[k]).join(" e ")} →</button>` : ""}`
        : `<p class="section-lede">Novos gatos chegam toda semana. Deixe seu contato e avisamos quando chegar um que conviva com ${needs.map((k) => NEED_LABEL[k]).join(" e ")}.</p>
           <a class="btn btn-wa" href="#" data-wa="Olá! Fiz o quiz do site ${SITE.name}. Procuro um gato que conviva com ${needs.map((k) => NEED_LABEL[k]).join(" e ")}. Podem me avisar quando chegar?">${ICON_CHAT} Me avise pelo WhatsApp</a>`}
      </div>`;
    applyWhatsappLinks(root);
    root.querySelector("#match-h").focus({ preventScroll: true });
    loadAllPhotos();
  }

  root.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.hasAttribute("data-start")) { step = 0; question(); }
    else if (t.hasAttribute("data-back")) { step--; question(); }
    else if (t.hasAttribute("data-restart")) { step = 0; for (const k in answers) delete answers[k]; question(); }
    else if (t.classList.contains("match-opt")) {
      const q = QUESTIONS[step];
      answers[q.key] = q.key === "energy" ? Number(t.dataset.value) : t.dataset.value;
      step++;
      step < QUESTIONS.length ? question() : results();
    } else if (t.hasAttribute("data-apply")) {
      // Leva as exigências de convivência para os filtros da grade
      document.querySelectorAll("#filters [data-need]").forEach((b) => {
        const on = needsFrom(answers).includes(b.dataset.need);
        b.setAttribute("aria-pressed", String(on));
        on ? filterState.need.add(b.dataset.need) : filterState.need.delete(b.dataset.need);
      });
      applyFilter();
      document.getElementById("gatos").scrollIntoView();
    }
  });

  intro();
}
