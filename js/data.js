/* ==========================================================================
   Dados dos gatos e dos filtros.
   Para adicionar um gato, inclua um objeto em CATS — o resto da página se ajusta.
   ========================================================================== */

// Fotos escolhidas à mão na TheCatAPI (ilustrativas, não são os gatos do abrigo), com a mesma
// pelagem da ilustração de cada gato. Ficam em photos/ em dois tamanhos: <id>-640.jpg e <id>-1600.jpg
// (JPEG qualidade 80); "source" guarda a original. "focus" = ponto do rosto, usado no enquadramento.
const CAT_PHOTO = "https://cdn2.thecatapi.com/images/";

// Perfil de cada gato (usado nos filtros, no quiz e na ficha):
// since = chegada ao lar temporário (AAAA-MM-DD) · energy = 1 calmo, 2 meio-termo, 3 agitado
// traits = personalidade · kids/dogs/cats = convive bem com crianças / cães / outros gatos
const CATS = [
  { id: "tangerina", name: "Tangerina", sex: "fêmea", age: "4 meses", group: "filhote",
    blurb: "Sobe em tudo e depois não sabe descer. Adora varinha com pena.",
    look: { fur: "#E8913A", stripe: "#B8621A", eye: "#8DBA4E", tabby: true },
    vac: "V4 · 1ª dose", with: "gatos, crianças",
    photo: "photos/tangerina", source: CAT_PHOTO + "8LxU2Gwmo.jpg", focus: "55% 40%",
    since: "2026-08-10", energy: 3, traits: ["brincalhona", "curiosa"], kids: true, dogs: false, cats: true },
  { id: "nanquim", name: "Nanquim", sex: "macho", age: "3 anos", group: "adulto",
    blurb: "Tímido nos primeiros dias, depois dorme no seu travesseiro.",
    look: { fur: "#26222E", eye: "#E7B53B" },
    vac: "V4 em dia", with: "gatos",
    photo: "photos/nanquim", source: CAT_PHOTO + "BkksyH95Z.jpg", focus: "66% 40%",
    since: "2026-03-02", energy: 2, traits: ["tímido", "carinhoso"], kids: false, dogs: false, cats: true },
  { id: "neblina", name: "Dona Neblina", sex: "fêmea", age: "11 anos", group: "idoso",
    blurb: "Ronrona alto, pede colo e quer um sofá tranquilo só para ela.",
    look: { fur: "#9A9AA8", stripe: "#777786", eye: "#D9A441", tabby: true },
    vac: "V4 em dia", with: "adultos",
    photo: "photos/neblina", source: CAT_PHOTO + "laq3GvUgh.jpg", focus: "55% 35%",
    since: "2025-11-18", energy: 1, traits: ["carinhosa", "calma"], kids: false, dogs: false, cats: false },
  { id: "bigode", name: "Bigode", sex: "macho", age: "2 anos", group: "adulto",
    blurb: "Conversador. Recebe visita na porta e come de tudo.",
    look: { fur: "#2B2733", eye: "#9CC45B", tux: true },
    vac: "V4 em dia", with: "gatos, cães, crianças",
    photo: "photos/bigode", source: CAT_PHOTO + "dr1.jpg", focus: "50% 30%",
    since: "2026-06-05", energy: 2, traits: ["sociável", "falante"], kids: true, dogs: true, cats: true },
  { id: "pacoca", name: "Paçoca", sex: "fêmea", age: "5 meses", group: "filhote",
    blurb: "Curiosa, quer saber o que tem dentro de toda sacola.",
    look: { fur: "#2E2926", eye: "#E2A73C", tri: true },
    vac: "V4 · 2ª dose", with: "gatos, crianças",
    photo: "photos/pacoca", source: CAT_PHOTO + "kdfcmTWJL.jpg", focus: "66% 50%",
    since: "2026-07-22", energy: 3, traits: ["curiosa", "brincalhona"], kids: true, dogs: false, cats: true },
  { id: "cha", name: "Chá", sex: "macho", age: "7 anos", group: "adulto",
    blurb: "Calmo e grudado: segue a pessoa de cômodo em cômodo.",
    look: { fur: "#EADFCB", eye: "#6FA6E0", siam: true },
    vac: "V4 em dia", with: "gatos, cães",
    photo: "photos/cha", source: CAT_PHOTO + "-AiX8QA5I.png", focus: "30% 35%",
    since: "2026-01-15", energy: 1, traits: ["calmo", "carinhoso"], kids: false, dogs: true, cats: true },
  { id: "pipoca", name: "Pipoca", sex: "macho", age: "3 meses", group: "filhote",
    blurb: "O menor da ninhada e o mais barulhento na hora da ração.",
    look: { fur: "#F5F3EF", eye: "#6FB3E8" },
    vac: "V4 · 1ª dose", with: "gatos, crianças",
    photo: "photos/pipoca", source: CAT_PHOTO + "4ndvXwCiI.jpg", focus: "40% 35%",
    since: "2026-09-01", energy: 3, traits: ["brincalhão", "falante"], kids: true, dogs: false, cats: true },
  { id: "lindolfo", name: "Seu Lindolfo", sex: "macho", age: "13 anos", group: "idoso",
    blurb: "Dorme 18 horas por dia. Nas outras 6, quer carinho no queixo.",
    look: { fur: "#D9853A", stripe: "#AD5E1E", eye: "#B9C24A", tabby: true },
    vac: "V4 em dia", with: "adultos, gatos",
    photo: "photos/lindolfo", source: CAT_PHOTO + "m1TeHn2dH.jpg", focus: "50% 35%",
    since: "2025-09-30", energy: 1, traits: ["calmo", "carinhoso"], kids: false, dogs: false, cats: true },
];

// Código de ficha: SV-001, SV-002...
CATS.forEach((c, i) => (c.code = "SV-" + String(i + 1).padStart(3, "0")));

// Dias desde a chegada e o texto "há 3 meses" usado nos cards e na ficha
function daysWaiting(c) {
  return Math.max(0, Math.floor((Date.now() - new Date(c.since + "T12:00:00")) / 864e5));
}
function waitLabel(c) {
  const d = daysWaiting(c);
  if (d < 14) return d <= 1 ? "chegou agora" : `há ${d} dias`;
  if (d < 60) return `há ${Math.round(d / 7)} semanas`;
  if (d < 345) return `há ${Math.round(d / 30)} meses`;
  const y = Math.max(1, Math.round(d / 365)), m = Math.max(0, Math.round((d - y * 365) / 30));
  return `há ${y} ano${y > 1 ? "s" : ""}` + (m ? ` e ${m} ${m > 1 ? "meses" : "mês"}` : "");
}
// Os dois que esperam há mais tempo ganham o selo "Espera longa"
const LONGEST_WAIT = [...CATS].sort((a, b) => daysWaiting(b) - daysWaiting(a)).slice(0, 2).map((c) => c.id);

const COMPAT = [
  { key: "kids", label: "Convive com crianças", short: "Crianças" },
  { key: "dogs", label: "Convive com cães", short: "Cães" },
  { key: "cats", label: "Convive com outros gatos", short: "Gatos" },
];

// Finais felizes. EXEMPLOS: troque por histórias reais, com autorização de quem adotou.
// look = mesma estrutura da ilustração dos gatos acima.
const ADOPTED = [
  { name: "Frida", sex: "fêmea", home: "Carla · Ininga", when: "junho de 2026",
    quote: "Nos primeiros dois dias ela só saiu de baixo da cama para comer. Hoje dorme no meu travesseiro e acorda a casa às seis.",
    look: { fur: "#2E2926", eye: "#E2A73C", tri: true } },
  { name: "Joca", sex: "macho", home: "Marcos e Ana · Fátima", when: "abril de 2026",
    quote: "A videochamada ajudou muito: a equipe viu a nossa varanda e indicou a tela certa antes de ele chegar.",
    look: { fur: "#E8913A", stripe: "#B8621A", eye: "#8DBA4E", tabby: true } },
  { name: "Dona Nuvem", sex: "fêmea", home: "Seu Raimundo · Horto", when: "fevereiro de 2026",
    quote: "Eu queria um gato calmo para me fazer companhia. Ela tem 12 anos e é exatamente isso.",
    look: { fur: "#9A9AA8", stripe: "#777786", eye: "#D9A441", tabby: true } },
];

const GROUP_LABEL = { filhote: "Filhote", adulto: "Adulto", idoso: "Idoso" };

const FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "filhote", label: "Filhotes" },
  { key: "adulto", label: "Adultos" },
  { key: "idoso", label: "Idosos" },
];
