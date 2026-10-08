/* ==========================================================================
   Dados dos gatos e dos filtros.
   Para adicionar um gato, inclua um objeto em CATS — o resto da página se ajusta.
   ========================================================================== */

// Perfil de cada gato (usado nos filtros, no quiz e na ficha):
// since = chegada ao lar temporário (AAAA-MM-DD) · energy = 1 calmo, 2 meio-termo, 3 agitado
// traits = personalidade · kids/dogs/cats = convive bem com crianças / cães / outros gatos
// Os gatos vêm do banco (Supabase, cadastrados pelo painel de administração).
// Esta lista fica vazia: se o banco não responder, o site avisa em vez de mostrar gatos de exemplo.
const CATS = [];

// Código de ficha: SV-001, SV-002... (gatos vindos do banco já trazem o código)
CATS.forEach((c, i) => (c.code ||= "SV-" + String(i + 1).padStart(3, "0")));

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
// Selo "Espera longa": os dois que esperam há mais tempo, desde que estejam há pelo menos
// LONG_WAIT_DAYS no lar temporário (com poucos gatos, quem acabou de chegar não ganha o selo)
const LONG_WAIT_DAYS = 90;
let LONGEST_WAIT = [];
function computeLongestWait() {
  LONGEST_WAIT = CATS.filter((c) => daysWaiting(c) >= LONG_WAIT_DAYS)
    .sort((a, b) => daysWaiting(b) - daysWaiting(a)).slice(0, 2).map((c) => c.id);
}
computeLongestWait();

// "Convive com ..." em texto, a partir dos três sim/não
function withText(c) {
  const yes = [c.kids && "crianças", c.dogs && "cães", c.cats && "gatos"].filter(Boolean);
  return yes.length ? yes.join(", ") : "adultos";
}

const COMPAT = [
  { key: "kids", label: "Convive com crianças", short: "Crianças" },
  { key: "dogs", label: "Convive com cães", short: "Cães" },
  { key: "cats", label: "Convive com outros gatos", short: "Gatos" },
];

// Finais felizes: { name, sex, home, when, quote, look } — look = mesma estrutura da ilustração dos gatos.
// Só histórias reais, com autorização de quem adotou. Lista vazia = a seção "Quem já foi para casa" some.
const ADOPTED = [];

const GROUP_LABEL = { filhote: "Filhote", adulto: "Adulto", idoso: "Idoso" };

const FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "filhote", label: "Filhotes" },
  { key: "adulto", label: "Adultos" },
  { key: "idoso", label: "Idosos" },
];
