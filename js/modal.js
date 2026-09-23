/* ==========================================================================
   Ficha do gato (<dialog>) e formulário de interesse.
   A foto do card "vira" a foto da ficha via View Transitions API;
   sem suporte (ou com movimento reduzido), a ficha usa a transição do CSS.
   O formulário monta a mensagem e abre o WhatsApp do abrigo (js/config.js).
   Cada ficha tem endereço próprio (#gato-<id>), para compartilhar e abrir direto.
   ========================================================================== */

let sheet, sheetContent;
let sourceBox = null;   // bloco de foto que abriu a ficha (card, destaque ou resultado do quiz)
let lastTrigger = null; // botão que abriu a ficha (recebe o foco de volta)

const canMorph = () => "startViewTransition" in document && !reduceMotion.matches;

function escapeHTML(text) {
  return text.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

const ICON_CHAT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.4L3 21l2.1-5.6A8.4 8.4 0 1 1 21 11.5z"/></svg>`;

// ---------- Compartilhar ----------
const catLink = (c) => location.origin + location.pathname + "#gato-" + c.id;
const shareText = (c) => `${c.name} (${c.age}) está procurando uma casa no ${SITE.name}: ${c.blurb}`;

// WhatsApp sem número: a pessoa escolhe para quem mandar
function shareWhatsapp(c) {
  return `https://wa.me/?text=${encodeURIComponent(`${shareText(c)}\n${catLink(c)}`)}`;
}

let copiedTimer;
async function shareCat(c, btn) {
  const url = catLink(c);
  if (navigator.share) {
    try { await navigator.share({ title: `${c.name} · ${SITE.name}`, text: shareText(c), url }); } catch {}
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    btn.classList.add("copied");
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => btn.classList.remove("copied"), 1600);
  } catch {
    prompt("Copie o link:", url);
  }
}

function sheetHTML(c) {
  const a = c.sex === "fêmea" ? "a" : "o";
  return `
    <button class="x" type="button" aria-label="Fechar" data-close>×</button>
    <div class="sheet-head">
      ${photoBox(c, "m-" + c.id, 'id="sheet-photo"')}
      <div>
        <span class="mono">${c.code} · ${GROUP_LABEL[c.group]}</span>
        <h2 id="sheet-name">${c.name}</h2>
        <div class="meta">${c.sex} · ${c.age}</div>
      </div>
    </div>
    <div class="sheet-body">
      <p>${c.blurb}</p>
      <div class="sheet-profile">
        <div class="tags">${c.traits.map((t) => `<span class="tag trait">${t}</span>`).join("")}</div>
        ${compatList(c)}
      </div>
      <dl class="ficha">
        <div><dt>Castrad${a}</dt><dd>Sim</dd></div>
        <div><dt>Vacinas</dt><dd>${c.vac}</dd></div>
        <div><dt>FIV / FeLV</dt><dd>Negativo</dd></div>
        <div><dt>Vermífugo</dt><dd>Em dia</dd></div>
        <div><dt>Microchip</dt><dd>Sim</dd></div>
        <div><dt>No lar temporário</dt><dd>${waitLabel(c)}</dd></div>
      </dl>
      <div class="share-row">
        <span class="mono">Conhece alguém que combina com ${a} ${c.name}?</span>
        <button class="btn btn-ghost btn-sm" type="button" data-share="${c.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>
          <span class="swap"><span>Compartilhar</span><span>Link copiado</span></span>
        </button>
        <a class="btn btn-ghost btn-sm" href="${shareWhatsapp(c)}" target="_blank" rel="noopener">${ICON_CHAT} Mandar no WhatsApp</a>
      </div>
      <div id="form-slot">
        <form class="adopt" novalidate>
          <h3>Quero conhecer ${a} ${c.name}</h3>
          <label class="field" for="f-nome">Seu nome
            <input id="f-nome" name="nome" type="text" autocomplete="name" required>
          </label>
          <label class="field" for="f-bairro">Bairro e cidade
            <input id="f-bairro" name="bairro" type="text" autocomplete="address-level2" placeholder="Ex.: Fátima, Teresina" required>
          </label>
          <fieldset class="field">
            <legend>Você mora em</legend>
            <div class="radios">
              <label><input type="radio" name="moradia" value="Casa" id="f-mor-casa"> Casa</label>
              <label><input type="radio" name="moradia" value="Apartamento" id="f-mor-apto"> Apartamento</label>
            </div>
          </fieldset>
          <fieldset class="field">
            <legend>As janelas têm tela de proteção?</legend>
            <div class="radios">
              <label><input type="radio" name="tela" value="Sim" id="f-tela-sim"> Sim</label>
              <label><input type="radio" name="tela" value="Vou instalar" id="f-tela-vou"> Vou instalar</label>
              <label><input type="radio" name="tela" value="Não" id="f-tela-nao"> Não</label>
            </div>
          </fieldset>
          <label class="check" for="f-termo">
            <input type="checkbox" id="f-termo" name="termo">
            <span>Tenho 18 anos ou mais e li os <a href="antes-de-adotar.html#requisitos">requisitos da adoção</a>.</span>
          </label>
          <p class="error" id="f-err" role="alert" hidden></p>
          <button class="btn btn-wa" type="submit">${ICON_CHAT} Enviar pelo WhatsApp</button>
          <p class="hint">Abre o WhatsApp com a mensagem pronta para ${SITE.whatsappDisplay}. É só tocar em enviar.</p>
        </form>
      </div>
    </div>`;
}

function openCat(c, trigger, { instant = false } = {}) {
  lastTrigger = trigger;
  sourceBox = trigger?.closest(".card, .scanner, .match")?.querySelector(".photo") || null;

  const render = () => {
    sheet.dataset.cat = c.id;
    sheetContent.innerHTML = sheetHTML(c);
    const box = sheetContent.querySelector("#sheet-photo");
    if (photoUrl[c.id]) attachPhoto(box, photoUrl[c.id], false);
    sheet.showModal();
    history.replaceState(null, "", "#gato-" + c.id);
  };

  if (instant || !sourceBox || !canMorph()) return render();

  sheet.classList.add("vt");
  sourceBox.style.viewTransitionName = "cat-photo";
  const t = document.startViewTransition(() => {
    sourceBox.style.viewTransitionName = "";
    render();
    sheetContent.querySelector("#sheet-photo").style.viewTransitionName = "cat-photo";
  });
  t.ready.catch(() => {}); // transição pulada (ex.: aba em segundo plano): a ficha abre mesmo assim
  t.finished.finally(() => sheet.classList.remove("vt")).catch(() => {});
}

function closeSheet() {
  if (!sheet.open) return;
  history.replaceState(null, "", location.pathname + location.search);
  const modalBox = sheetContent.querySelector("#sheet-photo");

  // Sem morph se o card de origem sumiu (ex.: filtrado)
  if (!canMorph() || !sourceBox?.isConnected || sourceBox.closest("[hidden]")) return sheet.close();

  sheet.classList.add("vt");
  const t = document.startViewTransition(() => {
    if (modalBox) modalBox.style.viewTransitionName = "";
    sheet.close();
    sourceBox.style.viewTransitionName = "cat-photo";
  });
  t.ready.catch(() => {});
  t.finished.finally(() => {
    sourceBox.style.viewTransitionName = "";
    sheet.classList.remove("vt");
  }).catch(() => {});
}

function adoptionMessage(cat, f) {
  return [
    `Olá! Tenho interesse em adotar ${cat.name} (${cat.code}, ${cat.sex}, ${cat.age}).`,
    "",
    `Nome: ${f.nome}`,
    `Bairro/cidade: ${f.bairro}`,
    `Moradia: ${f.moradia}`,
    `Tela de proteção nas janelas: ${f.tela}`,
    "",
    `Enviado pelo site ${SITE.name}.`,
  ].join("\n");
}

function handleSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const err = form.querySelector("#f-err");
  const values = {
    nome: form.nome.value.trim(),
    bairro: form.bairro.value.trim(),
    moradia: form.moradia.value,
    tela: form.tela.value,
  };

  let msg = "";
  if (!values.nome) msg = "Escreva seu nome para a equipe saber com quem vai falar.";
  else if (!values.bairro) msg = "Informe seu bairro e cidade — a entrega é feita pela equipe.";
  else if (!values.moradia) msg = "Conte se você mora em casa ou apartamento.";
  else if (!values.tela) msg = "Responda sobre a tela de proteção — é o primeiro assunto da conversa.";
  else if (!form.termo.checked) msg = "Confirme que tem 18 anos ou mais e leu os requisitos.";
  if (msg) {
    err.textContent = msg;
    err.hidden = false;
    return;
  }

  const cat = CATS.find((c) => c.id === form.closest("dialog").dataset.cat);
  const url = whatsappLink(adoptionMessage(cat, values));
  window.open(url, "_blank", "noopener");

  const telaNote = values.tela === "Não"
    ? "Como a casa ainda não tem tela, a conversa começa por aí."
    : "Na videochamada, a equipe mostra a rotina do gato e vê as janelas.";

  document.getElementById("form-slot").innerHTML = `
    <div class="done" role="status">
      <div class="badge"><svg viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="27"/><path d="M17 29l7 7 15-16"/></svg></div>
      <span class="mono">Mensagem pronta · ${cat.code}</span>
      <h3>Agora é só tocar em enviar, ${escapeHTML(values.nome.split(" ")[0])}.</h3>
      <p>Abrimos o WhatsApp com seu interesse em ${cat.name}. A mensagem só chega à equipe depois que você enviar por lá. ${telaNote}</p>
      <div class="cta-row">
        <a class="btn btn-wa" href="${url}" target="_blank" rel="noopener">${ICON_CHAT} Abrir o WhatsApp de novo</a>
        <button class="btn btn-ghost" type="button" data-close>Voltar aos gatos</button>
      </div>
    </div>`;
}

function initModal() {
  sheet = document.getElementById("sheet");
  sheetContent = document.getElementById("sheet-content");

  // Cards, destaque da semana e resultado do quiz abrem a ficha
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-open]");
    if (b && !b.closest("dialog")) openCat(CATS.find((c) => c.id === b.dataset.open), b);
  });

  // Link direto: index.html#gato-tangerina abre a ficha
  const fromHash = () => {
    const c = CATS.find((c) => location.hash === "#gato-" + c.id);
    if (c && !sheet.open) openCat(c, document.querySelector(`#grid [data-open="${c.id}"]`), { instant: true });
  };
  fromHash();
  addEventListener("hashchange", fromHash);

  sheet.addEventListener("click", (e) => {
    const b = e.target.closest("[data-share]");
    if (b) shareCat(CATS.find((c) => c.id === b.dataset.share), b);
  });

  // Clique fora da ficha ou no botão de fechar
  sheet.addEventListener("click", (e) => {
    if (e.target === sheet || e.target.closest("[data-close]")) closeSheet();
  });
  // Esc passa pelo mesmo caminho, para ter a animação de volta
  sheet.addEventListener("cancel", (e) => {
    e.preventDefault();
    closeSheet();
  });
  sheet.addEventListener("close", () => lastTrigger?.focus({ preventScroll: true }));
  sheet.addEventListener("submit", handleSubmit);
}
