/* ==========================================================================
   "Sete vidas" — monta as cenas e liga cada uma à rolagem.
   Cada cena recebe --p (0 → 1) conforme atravessa a tela; o CSS
   (css/vidas.css) faz as transformações a partir desses valores.
   ========================================================================== */

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const range = (p, from, to) => clamp01((p - from) / (to - from));
const easeIn = (t) => t * t * t;

const catById = (id) => CATS.find((c) => c.id === id);

// ---------- Montagem ----------

function buildCollage() {
  // O mosaico começa ampliado 1,45×: pede a foto maior para não borrar
  document.getElementById("collage").innerHTML = CATS.map((c) => photoBox(c, "co-" + c.id, 'data-sizes="60vw"')).join("");
}

function buildCharacters() {
  document.querySelectorAll('[data-scene="char"]').forEach((scene) => {
    const c = catById(scene.dataset.cat);
    const sats = scene.dataset.sats.split(",").map(catById);
    const a = c.sex === "fêmea" ? "a" : "o";
    scene.querySelector(".stage").innerHTML = `
      <figure class="char-photo">${photoBox(c, "ch-" + c.id)}</figure>
      <div class="char-copy">
        <p class="mono rise">${c.code} · ${GROUP_LABEL[c.group]} · ${c.age}</p>
        <h2 class="char-name rise">${c.name}</h2>
        <div class="rise">
          <blockquote>“${c.blurb}”</blockquote>
          <div class="facts"><span>Convive com ${c.with}</span><span>${c.vac}</span><span>FIV/FeLV −</span></div>
          <div class="cta-row" style="margin-top:24px">
            <a class="btn btn-primary" href="index.html#gato-${c.id}">Quero conhecer ${a} ${c.name.split(" ").pop()}</a>
          </div>
        </div>
      </div>
      ${sats.map((s, i) => `
        <figure class="sat s${i + 1}" aria-hidden="true">
          ${photoBox(s, `sat-${c.id}-${s.id}`)}
          <figcaption class="mono">${i === 0 ? "Divide o quarto com" : "Amig" + (s.sex === "fêmea" ? "a" : "o")} ${s.name}</figcaption>
        </figure>`).join("")}`;
  });
}

function buildCast() {
  const cols = [[], [], []];
  CATS.forEach((c, i) => cols[i % 3].push(c));
  document.getElementById("cast-count").textContent = CATS.length;
  document.getElementById("cast").innerHTML = cols.map((col) => `
    <div class="cast-col">
      ${col.map((c) => `
        <a class="cast-card" href="index.html#gato-${c.id}" aria-label="${c.name}, ${c.age} — ver ficha">
          ${photoBox(c, "ca-" + c.id)}
          <span class="label"><b>${c.name}</b><span class="mono">${c.code}</span></span>
        </a>`).join("")}
    </div>`).join("");
}

// ---------- Capítulos (navegação lateral, como no site de referência) ----------

let chapters = [];
function buildChapters() {
  const nav = document.getElementById("chapters");
  const secs = [...document.querySelectorAll("[data-chapter]")];
  nav.innerHTML = `<ol>${secs.map((el) => `
    <li><a href="#${el.id}"><span class="dot" aria-hidden="true"></span><span class="label">${el.dataset.chapter}</span></a></li>`).join("")}</ol>`;
  chapters = secs.map((el) => ({ el, link: nav.querySelector(`a[href="#${el.id}"]`), top: 0 }));
}
function measureChapters() {
  chapters.forEach((ch) => (ch.top = ch.el.getBoundingClientRect().top + scrollY));
}
let currentChapter = null;
let flashTimer;
function markChapter(y) {
  // Capítulo atual = o último cujo topo já passou de 40% da tela
  let cur = chapters[0];
  for (const ch of chapters) if (ch.top <= y + innerHeight * 0.4) cur = ch;
  if (cur === currentChapter) return;
  currentChapter?.link.removeAttribute("aria-current");
  cur.link.setAttribute("aria-current", "true");
  if (currentChapter) {
    currentChapter.link.classList.remove("flash");
    cur.link.classList.add("flash");
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => cur.link.classList.remove("flash"), 1600);
  }
  currentChapter = cur;
}

// ---------- Papel de parede (gerado no navegador, baixado como JPEG) ----------

function initWallpaper() {
  const canvas = document.getElementById("wall-canvas");
  const picker = document.getElementById("wall-cats");
  const ctx = canvas.getContext("2d");
  picker.innerHTML = CATS.map((c, i) => `
    <label class="wall-cat"><input type="radio" name="wall-cat" value="${c.id}"${i === 0 ? " checked" : ""}><span>${c.name}</span></label>`).join("");

  const pick = () => catById(picker.querySelector("input:checked").value);
  const size = () => document.querySelector('input[name="wall-size"]:checked').value.split("x").map(Number);
  let token = 0;

  async function render() {
    const c = pick();
    const [w, h] = size();
    const my = ++token;
    const img = new Image();
    img.src = `${c.photo}-1600.jpg`;
    await Promise.all([
      img.decode(),
      document.fonts?.load('700 120px "Unbounded"'),
      document.fonts?.load('500 24px "JetBrains Mono"'),
    ]).catch(() => {});
    if (my !== token || !img.naturalWidth) return; // outra escolha chegou antes

    canvas.width = w;
    canvas.height = h;
    const portrait = h > w;

    // Foto cobrindo a tela, com o rosto no ponto de foco (mesma regra do object-position)
    const [fx, fy] = (c.focus || "50% 50%").split(" ").map((v) => parseFloat(v) / 100);
    const k = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * k, dh = img.naturalHeight * k;
    ctx.drawImage(img, (w - dw) * fx, (h - dh) * fy, dw, dh);

    // Escurece onde fica o texto: embaixo no celular, à esquerda no computador
    let g = ctx.createLinearGradient(0, h * 0.45, 0, h);
    g.addColorStop(0, "rgba(7,9,15,0)");
    g.addColorStop(1, "rgba(7,9,15,0.94)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    if (!portrait) {
      g = ctx.createLinearGradient(0, 0, w * 0.6, 0);
      g.addColorStop(0, "rgba(7,9,15,0.8)");
      g.addColorStop(1, "rgba(7,9,15,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    const base = Math.min(w, h);
    const x = portrait ? w * 0.08 : w * 0.06;
    const y = portrait ? h * 0.8 : h * 0.72;
    const vii = base * (portrait ? 0.26 : 0.2);

    ctx.font = `700 ${vii}px Unbounded, sans-serif`;
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${-vii * 0.045}px`;
    const tw = ctx.measureText("VII").width;
    const sg = ctx.createLinearGradient(x, 0, x + tw, 0);
    [["#FF4F8B", 0], ["#FF8A3D", 0.45], ["#FFB23E", 0.7], ["#8F7BFF", 1]].forEach(([col, at]) => sg.addColorStop(at, col));
    ctx.fillStyle = sg;
    ctx.fillText("VII", x, y);

    if ("letterSpacing" in ctx) ctx.letterSpacing = `${-base * 0.002}px`;
    ctx.font = `700 ${base * 0.075}px Unbounded, sans-serif`;
    ctx.fillStyle = "#E8ECF8";
    ctx.fillText(c.name, x, y + base * 0.1);

    if ("letterSpacing" in ctx) ctx.letterSpacing = `${base * 0.004}px`;
    ctx.font = `500 ${base * 0.024}px "JetBrains Mono", monospace`;
    ctx.fillStyle = "rgba(232,236,248,0.72)";
    ctx.fillText(`${c.code} · ${SITE.name} · ${SITE.city}`.toUpperCase(), x, y + base * 0.155);
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";

    canvas.setAttribute("aria-label", `Prévia do papel de parede de ${c.name}, ${w}×${h}`);
    canvas.closest(".wall-preview").classList.toggle("landscape", !portrait);
  }

  document.getElementById("papeis").addEventListener("change", render);
  document.getElementById("wall-download").addEventListener("click", () => {
    const c = pick();
    const [w, h] = size();
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `sete-vidas-${c.id}-${w}x${h}.jpg`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, "image/jpeg", 0.92);
  });

  // Só desenha quando a seção se aproxima: a foto grande não pesa no carregamento
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    render();
  }, { rootMargin: "600px 0px" });
  io.observe(canvas);
}

// ---------- Rolagem ----------

const root = document.documentElement;
const sky = document.querySelector(".sky");
const header = document.querySelector("header.top");
let scenes = [];

// A "câmera" entra pelo último "I" do VII mudando o viewBox do SVG (não com transform: scale).
// Ampliar a camada 90× fazia o navegador rasterizar blocos gigantes que sumiam ao voltar ao topo;
// com o viewBox o desenho continua vetorial e nítido em qualquer zoom.
let maskView = null;
function measureMaskOrigin() {
  const svg = document.getElementById("mask-layer");
  const text = document.getElementById("vii-text");
  const w = svg.clientWidth, h = svg.clientHeight;
  // Tela deitada: o VII ocupa ~40% da largura; em pé, o recorte fecha nele
  const vb = w < h ? [380, 0, 840, 900] : [0, 0, 1600, 900];
  svg.setAttribute("viewBox", vb.join(" "));
  let fx = 800, fy = 450;
  try {
    const box = text.getExtentOfChar(2);
    fx = box.x + box.width / 2;
    fy = box.y + box.height / 2;
  } catch {}
  maskView = { vb, fx, fy, zoom: 0 };
}

function setMaskZoom(z) {
  if (!maskView || maskView.zoom === z) return;
  maskView.zoom = z;
  const [x0, y0, w0, h0] = maskView.vb;
  const { fx, fy } = maskView;
  // Mantém o ponto (fx, fy) parado na tela enquanto o recorte encolhe
  const vb = [fx - (fx - x0) / z, fy - (fy - y0) / z, w0 / z, h0 / z];
  document.getElementById("mask-layer").setAttribute("viewBox", vb.map((n) => n.toFixed(3)).join(" "));
}

function measure() {
  scenes = [...document.querySelectorAll("[data-scene]")].map((el) => ({
    el,
    type: el.dataset.scene,
    top: el.getBoundingClientRect().top + scrollY,
    height: el.offsetHeight,
  }));
  const track = document.getElementById("track");
  track.style.setProperty("--track-shift", Math.max(0, track.scrollWidth - innerWidth) + "px");
  measureMaskOrigin();
  measureChapters();
}

const heroMask = () => document.getElementById("mask-layer");
let lastLife = "";

function update() {
  const y = scrollY, vh = innerHeight;
  const max = document.documentElement.scrollHeight - vh;
  // Só o céu usa o progresso da página: escrever no :root recalcularia o estilo do documento inteiro
  sky.style.setProperty("--page-p", (max > 0 ? y / max : 0).toFixed(3));
  header.classList.toggle("solid", y > 40);
  markChapter(y);

  for (const s of scenes) {
    // Cenas com palco fixo: 0 quando o topo encosta, 1 quando o palco solta
    const pinned = s.type !== "cast";
    const p = pinned
      ? clamp01((y - s.top) / (s.height - vh))
      : clamp01((y + vh - s.top) / (s.height + vh)) * 2 - 1; // -1 → 1 atravessando a tela
    // Fora da tela: não mexe no estilo
    if (y + vh < s.top - vh || y > s.top + s.height + vh) continue;
    const st = s.el.style;
    st.setProperty("--p", p.toFixed(4));

    if (s.type === "hero") {
      const t = range(p, 0, 0.5);
      const mask = heroMask();
      setMaskZoom(+(1 + easeIn(t) * 90).toFixed(3));
      mask.style.opacity = 1 - range(t, 0.8, 1);
      mask.style.visibility = t >= 1 ? "hidden" : "visible";
      st.setProperty("--collage", range(p, 0.15, 0.75).toFixed(4));
      st.setProperty("--lock", range(p, 0.5, 0.75).toFixed(4));
    } else if (s.type === "char") {
      st.setProperty("--in", range(p, 0, 0.35).toFixed(4));
      st.setProperty("--txt", range(p, 0.22, 0.45).toFixed(4));
      st.setProperty("--out", range(p, 0.75, 1).toFixed(4));
    } else if (s.type === "lives") {
      // Pequena pausa no começo e no fim, para o primeiro e o último card ficarem inteiros
      st.setProperty("--tp", range(p, 0.06, 0.94).toFixed(4));
      const n = "0" + Math.min(7, Math.floor(p * 7) + 1);
      if (n !== lastLife) document.getElementById("life-now").textContent = lastLife = n;
    }
  }
}

let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => { ticking = false; update(); });
}

// ---------- Início ----------

buildCollage();
buildCharacters();
buildCast();
buildChapters();
initWallpaper();
loadAllPhotos();

if (reduceMotion.matches) {
  root.classList.add("still");
  const onStill = () => { header.classList.toggle("solid", scrollY > 40); markChapter(scrollY); };
  measureChapters();
  onStill();
  addEventListener("scroll", onStill, { passive: true });
  addEventListener("resize", () => { measureChapters(); onStill(); });
  addEventListener("load", () => { measureChapters(); onStill(); });
} else {
  measure();
  update();
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", () => { measure(); update(); });
  // A fonte muda a largura do "VII" e dos cards: mede de novo quando chegar
  document.fonts?.ready.then(() => { measure(); update(); });
  addEventListener("load", () => { measure(); update(); });
}
