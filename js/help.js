/* ==========================================================================
   "Como ajudar" — valor do apadrinhamento e chave PIX.
   ========================================================================== */

// O que cada valor mensal cobre (edite conforme os custos reais do abrigo)
const SPONSOR_AMOUNTS = [
  { key: "30", label: "R$ 30", impact: "Cobre a ração de um gato adulto por um mês." },
  { key: "50", label: "R$ 50", impact: "Ração e areia de um gato por um mês." },
  { key: "100", label: "R$ 100", impact: "Ração, areia e antipulgas de dois gatos por um mês." },
];

function initSponsor() {
  const seg = document.getElementById("sponsor-seg");
  if (!seg) return;
  const impact = document.getElementById("sponsor-impact");
  const cta = document.getElementById("sponsor-cta");

  createSegmented(seg, SPONSOR_AMOUNTS, "50", (key) => {
    const opt = SPONSOR_AMOUNTS.find((o) => o.key === key);
    impact.textContent = opt.impact;
    cta.dataset.wa = `Olá! Quero apadrinhar um gato do ${SITE.name} com ${opt.label} por mês. Como faço?`;
    applyWhatsappLinks(cta.parentElement);
  });
}

function initPix() {
  const withKey = document.getElementById("pix-key");
  const withoutKey = document.getElementById("pix-ask");
  if (!withKey) return;

  if (!SITE.pixKey) {
    withKey.hidden = true;
    withoutKey.hidden = false;
    return;
  }

  withKey.querySelector("code").textContent = SITE.pixKey;
  const btn = withKey.querySelector("button");
  let timer;
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(SITE.pixKey);
    } catch {
      // Sem acesso à área de transferência: seleciona o texto para copiar à mão
      getSelection().selectAllChildren(withKey.querySelector("code"));
      return;
    }
    btn.classList.add("copied");
    clearTimeout(timer);
    timer = setTimeout(() => btn.classList.remove("copied"), 1600);
  });
}

initSponsor();
initPix();
