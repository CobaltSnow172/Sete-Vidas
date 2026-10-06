/* ==========================================================================
   Configuração do site — edite aqui.
   ========================================================================== */

const SITE = {
  name: "Sete Vidas",
  city: "Teresina, PI",

  // WhatsApp que recebe as mensagens: código do país + DDD + número, só dígitos
  whatsapp: "5586999971151",
  whatsappDisplay: "(86) 99997-1151",

  // Chave PIX para doações (CPF, CNPJ, e-mail, telefone ou chave aleatória).
  // Vazio = a página "Como ajudar" pede a chave pelo WhatsApp.
  pixKey: "",

  // Supabase: contas, login, painel de administração e cadastro de gatos.
  // A chave "publishable" é pública por natureza (vai no site); quem protege os
  // dados são as regras do banco em supabase/migrations/. Nunca coloque aqui a
  // chave secreta (service_role / sb_secret_...).
  supabaseUrl: "https://zosxgljvcgaogsjcrvxi.supabase.co",
  supabaseKey: "sb_publishable_QHLR8srXkti6DYFFK4J2aA_dJA2KTkO",
};

// Link que abre o WhatsApp com a mensagem já escrita
function whatsappLink(message) {
  return `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(message)}`;
}
