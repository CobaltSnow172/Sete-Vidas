/* ==========================================================================
   Ponto de entrada. Os scripts são carregados com "defer", nesta ordem:
   data → db → illustration → animations → api → catalog → match → modal → main
   Os gatos vêm do Supabase (js/db.js → loadCats); sem banco, a página avisa.
   ========================================================================== */

const NUM_WORDS = ["Nenhum", "Um", "Dois", "Três", "Quatro", "Cinco", "Seis", "Sete", "Oito", "Nove", "Dez",
  "Onze", "Doze", "Treze", "Catorze", "Quinze", "Dezesseis", "Dezessete", "Dezoito", "Dezenove", "Vinte"];

// "Oito gatos procurando uma casa." com o número real (a linha fica invisível até o banco responder)
function renderHeroCount() {
  if (catsLoadFailed) return; // sem número confiável: a linha continua só com "Gatos"
  const n = CATS.length;
  const word = NUM_WORDS[n] || String(n);
  document.getElementById("hero-count").textContent = `${word} ${n <= 1 ? "gato" : "gatos"}`;
  document.getElementById("hero-count-line").classList.remove("count-pending");
}

// Finais felizes: ilustração do gato + mensagem de quem adotou
function renderStories() {
  document.getElementById("adotados").hidden = !ADOPTED.length;
  document.getElementById("stories").innerHTML = ADOPTED.map((a, i) => `
    <figure class="story reveal">
      <div class="story-art">${catSVG(a, "st-" + i)}<span class="mono">Adotad${a.sex === "fêmea" ? "a" : "o"} em ${a.when}</span></div>
      <blockquote>“${a.quote}”</blockquote>
      <figcaption><b>${a.name}</b><span>${a.home}</span></figcaption>
    </figure>`).join("");
}

// Lista vazia (banco fora do ar ou nenhum gato cadastrado): o aviso de "sem resultado" dos filtros
// vira a mensagem da seção, e os filtros somem
function renderCatsNotice() {
  if (CATS.length) return;
  const empty = document.getElementById("empty");
  empty.querySelector("p").textContent = catsLoadFailed
    ? "Não conseguimos carregar os gatos agora. Recarregue a página em instantes ou fale com a gente pelo WhatsApp."
    : "Nenhum gato esperando adoção neste momento. Novos gatos chegam com frequência, volte em breve.";
  document.getElementById("empty-reset").hidden = true;
  document.getElementById("filters").hidden = true;
}

loadCats().then(() => {
  renderHeroCount();
  if (CATS.length) renderScanner(featuredCat());
  else document.getElementById("scanner").hidden = true;
  renderGrid();
  renderCatsNotice();
  initFilter();
  applyFilter();
  initMatch();
  renderStories();
  initModal();
  loadAllPhotos();
  syncFavButtons();
});

// Scanner do topo: inclina de leve seguindo o cursor e sobe um pouco mais rápido que a página
// (se descesse, invadiria a seção de baixo)
(function scannerDepth() {
  const el = document.getElementById("scanner");
  if (reduceMotion.matches || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  el.addEventListener("pointermove", (e) => {
    const r = el.getBoundingClientRect();
    el.style.setProperty("--ry", ((e.clientX - r.left) / r.width - 0.5) * 8 + "deg");
    el.style.setProperty("--rx", ((e.clientY - r.top) / r.height - 0.5) * -8 + "deg");
  });
  el.addEventListener("pointerleave", () => { el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); });
  addEventListener("scroll", () => {
    if (scrollY < innerHeight) el.style.setProperty("--sy", scrollY * -0.1 + "px");
  }, { passive: true });
})();

// Letreiro da chamada "Sete vidas": anda conforme a rolagem, parado se a pessoa não rola
(function teaserMarquee() {
  const teaser = document.querySelector(".teaser");
  if (!teaser || reduceMotion.matches) return;
  addEventListener("scroll", () => {
    const r = teaser.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    teaser.style.setProperty("--mq", ((innerHeight - r.top) * 0.4).toFixed(1));
  }, { passive: true });
})();
