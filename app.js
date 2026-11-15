"use strict";

const $ = (id) => document.getElementById(id);
const el = (tag, classe, texto) => {
  const no = document.createElement(tag);
  if (classe) no.className = classe;
  if (texto !== undefined) no.textContent = texto;
  return no;
};
const dataCurta = (iso) => {
  const [, mes, dia] = iso.slice(0, 10).split("-");
  return `${Number(dia)}/${Number(mes)}`;
};
const numero = (valor) => String(valor).replace(".", ",");

function mosaico(rotulo, valor, unidade, semDado) {
  const caixa = el("div", "mosaico");
  caixa.append(el("div", "rotulo", rotulo));
  if (valor === null || valor === undefined) {
    caixa.append(el("div", "vazio", semDado));
  } else {
    const linha = el("div", "valor", numero(valor));
    if (unidade) linha.append(" ", el("small", null, unidade));
    caixa.append(linha);
  }
  return caixa;
}

function mostrarPlano(plano, caixa = $("plano")) {
  if (!plano || !plano.sessoes.length) {
    caixa.append(el("p", "discreto", "Ainda não há plano aprovado para esta semana."));
    return;
  }
  const hoje = new Date().toLocaleDateString("sv-SE"); // AAAA-MM-DD na hora local
  const porDia = new Map();
  for (const s of plano.sessoes) {
    const dia = s.inicio.slice(0, 10);
    if (!porDia.has(dia)) porDia.set(dia, []);
    porDia.get(dia).push(s);
  }
  for (const [dia, sessoes] of porDia) {
    const bloco = el("div", dia === hoje ? "dia hoje" : "dia");
    const nome = new Date(`${dia}T12:00:00`).toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "numeric" });
    bloco.append(el("p", "dia-nome", dia === hoje ? `Hoje, ${nome}` : nome));
    for (const s of sessoes) {
      const cartao = el("div", "sessao");
      const detalhes = el("details");
      const topo = el("summary");
      const esquerda = el("div");
      // A IA repete muitas vezes a modalidade no título ("Ginásio - Core").
      const titulo = s.titulo.replace(new RegExp(`^${s.modalidade}\\s*[-–:]?\\s*`, "i"), "") || s.titulo;
      esquerda.append(el("div", null, `${s.modalidade}: ${titulo}`),el("div", "hora", `${s.inicio.slice(11, 16)} · ${s.intensidade}`));
      const medidas = [s.km ? `${numero(s.km)} km` : null, `${s.minutos} min`].filter(Boolean).join(" · ");
      topo.append(esquerda, el("div", "medidas", medidas));
      if (s.estado === "feita" || s.estado === "nao_feita") {
        const feito = [s.feito_km ? `${numero(s.feito_km)} km` : null, s.feito_min ? `${s.feito_min} min` : null].filter(Boolean).join(" · ");
        const texto = s.estado === "feita" ? `✓ Feito${feito ? `: ${feito}` : ""}` : "✗ Não feito";
        esquerda.append(el("div", `resultado ${s.estado}`, texto));
      }
      const lista = el("ul");
      for (const linha of s.detalhe) lista.append(el("li", null, linha));
      detalhes.append(topo, lista);
      if (dia === hoje) detalhes.open = true;
      cartao.append(detalhes);
      bloco.append(cartao);
    }
    caixa.append(bloco);
  }
}

function mostrarHoje(saude) {
  // O dia mais recente com algum dado do relógio (hoje pode ainda não ter sincronizado).
  const comDados = [...saude].reverse().find((d) => d.fc_repouso !== null || d.stress !== null);
  const dia = comDados || saude[saude.length - 1];
  $("t-hoje").textContent = dia.dia === saude[saude.length - 1].dia ? "Hoje" : `Último dia com dados (${dataCurta(dia.dia)})`;
  $("hoje").append(
    mosaico("FC de repouso", dia.fc_repouso, "bpm", "sem dados"),
    mosaico("Body Battery máx.", dia.body_battery_max, null, "sem dados"),
    mosaico("Stress médio", dia.stress, null, "sem dados"),
    mosaico("Sono", dia.sono_horas, "h", "sem relógio"),
    mosaico("HRV da noite", dia.hrv, "ms", "sem relógio"),
    mosaico("Readiness", dia.readiness, null, "sem sono"),
  );
  if (dia.sono_horas === null) {
    const aviso = $("aviso-relogio");
    aviso.textContent = "Sem sono nem HRV: o relógio não foi usado durante a noite. O treinador decide pelo check-in.";
    aviso.hidden = false;
  }
}

function mostrarGrafico(saude) {
  const pontos = saude.map((d, i) => ({ i, dia: d.dia, v: d.fc_repouso })).filter((p) => p.v !== null);
  const corpo = $("tabela-fc").querySelector("tbody");
  for (const d of saude) {
    const linha = el("tr");
    linha.append(el("td", null, dataCurta(d.dia)), el("td", null, d.fc_repouso === null ? "—" : `${d.fc_repouso} bpm`));
    corpo.append(linha);
  }
  const caixa = $("grafico");
  if (pontos.length < 2) {
    caixa.append(el("p", "discreto", "Ainda não há dias suficientes com FC de repouso."));
    return;
  }

  // O desenho é reduzido para caber no telemóvel (~340 px), por isso as
  // medidas internas são generosas: o texto dos eixos fica com ~11 px no ecrã.
  const L = 600, A = 260, m = { e: 52, d: 14, c: 20, b: 40 };
  const valores = pontos.map((p) => p.v);
  const min = Math.floor((Math.min(...valores) - 2) / 5) * 5;
  const max = Math.ceil((Math.max(...valores) + 2) / 5) * 5;
  const x = (i) => m.e + (i / (saude.length - 1)) * (L - m.e - m.d);
  const y = (v) => m.c + (1 - (v - min) / (max - min)) * (A - m.c - m.b);
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${L} ${A}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `FC de repouso nos últimos 30 dias, entre ${Math.min(...valores)} e ${Math.max(...valores)} bpm`);
  const no = (nome, atributos, texto) => {
    const n = document.createElementNS(ns, nome);
    for (const [k, v] of Object.entries(atributos)) n.setAttribute(k, v);
    if (texto !== undefined) n.textContent = texto;
    svg.append(n);
    return n;
  };

  for (let v = min; v <= max; v += Math.max(5, Math.round((max - min) / 4 / 5) * 5)) {
    no("line", { class: "grade", x1: m.e, x2: L - m.d, y1: y(v), y2: y(v) });
    no("text", { class: "eixo", x: m.e - 10, y: y(v) + 7, "text-anchor": "end" }, v);
  }
  for (const i of [0, Math.round((saude.length - 1) / 2), saude.length - 1]) {
    no("text", { class: "eixo", x: x(i), y: A - 6, "text-anchor": i === 0 ? "start" : i === saude.length - 1 ? "end" : "middle" }, dataCurta(saude[i].dia));
  }

  // Dias sem dados interrompem a linha: não se inventa um valor entre eles.
  let troco = [];
  const trocos = [];
  for (const p of pontos) {
    if (troco.length && p.i !== troco[troco.length - 1].i + 1) { trocos.push(troco); troco = []; }
    troco.push(p);
  }
  trocos.push(troco);
  for (const t of trocos) {
    if (t.length === 1) no("circle", { class: "ponto", cx: x(t[0].i), cy: y(t[0].v), r: 4 });
    else no("path", { class: "linha", d: t.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ") });
  }

  const mira = no("line", { class: "mira", y1: m.c, y2: A - m.b, visibility: "hidden" });
  const marca = no("circle", { class: "ponto", r: 5, visibility: "hidden" });
  const dica = el("div", "dica");
  dica.hidden = true;
  caixa.append(svg, dica);

  const apontar = (evento) => {
    const caixaSvg = svg.getBoundingClientRect();
    const px = ((evento.clientX - caixaSvg.left) / caixaSvg.width) * L;
    const perto = pontos.reduce((a, b) => (Math.abs(x(b.i) - px) < Math.abs(x(a.i) - px) ? b : a));
    mira.setAttribute("x1", x(perto.i)); mira.setAttribute("x2", x(perto.i)); mira.setAttribute("visibility", "visible");
    marca.setAttribute("cx", x(perto.i)); marca.setAttribute("cy", y(perto.v)); marca.setAttribute("visibility", "visible");
    dica.textContent = `${dataCurta(perto.dia)}: ${perto.v} bpm`;
    dica.hidden = false;
    const meio = (x(perto.i) / L) * caixaSvg.width;
    dica.style.left = `${Math.min(Math.max(meio, 50), caixaSvg.width - 50)}px`;
  };
  const sair = () => { mira.setAttribute("visibility", "hidden"); marca.setAttribute("visibility", "hidden"); dica.hidden = true; };
  svg.addEventListener("pointermove", apontar);
  svg.addEventListener("pointerdown", apontar);
  svg.addEventListener("pointerleave", sair);
}

function mostrarSemana(semana) {
  for (const s of semana) {
    const bloco = el("div");
    const topo = el("div", "meta-topo");
    topo.append(el("strong", null, s.modalidade), el("span", "numeros", `${numero(s.feito)} de ${numero(s.alvo)} ${s.unidade}`));
    const trilho = el("div", "trilho");
    const barra = el("div");
    barra.style.width = `${Math.min(100, s.alvo ? (s.feito / s.alvo) * 100 : 0)}%`;
    trilho.append(barra);
    trilho.setAttribute("role", "progressbar");
    trilho.setAttribute("aria-valuenow", s.feito);
    trilho.setAttribute("aria-valuemin", 0);
    trilho.setAttribute("aria-valuemax", s.alvo);
    trilho.setAttribute("aria-label", `${s.modalidade}: ${s.feito} de ${s.alvo} ${s.unidade}`);
    bloco.append(topo, trilho, el("div", "meta-fundo", `Objetivo: ${numero(s.objetivo)} ${s.unidade} por semana`));
    $("semana").append(bloco);
  }
}

function mostrarAtividades(atividades) {
  if (!atividades.length) { $("atividades").append(el("p", "discreto", "Sem atividades registadas.")); return; }
  for (const a of atividades) {
    const linha = el("div", "atividade");
    const esquerda = el("div");
    esquerda.append(el("div", null, a.modalidade), el("div", "quando", `${dataCurta(a.inicio)} às ${a.inicio.slice(11, 16)}`));
    const partes = [];
    if (a.km) partes.push(`${numero(a.km)} km`);
    if (a.minutos) partes.push(`${a.minutos} min`);
    if (a.fc_media) partes.push(`${a.fc_media} bpm`);
    linha.append(esquerda, el("div", "medidas", partes.join(" · ")));
    $("atividades").append(linha);
  }
}

function mostrarZonas(zonas) {
  if (!zonas) { $("zonas").append(el("p", "discreto", "Zonas ainda não calculadas.")); return; }
  for (const [chave, nome] of [["corrida", "Corrida"], ["ciclismo", "Ciclismo"]]) {
    const bloco = el("div");
    bloco.append(el("p", "zonas-titulo", `${nome} — limiar ${zonas[chave].fc_limiar} bpm`));
    if (zonas[chave].origem.startsWith("estimativa")) bloco.append(el("p", "discreto", "Estimativa, por confirmar com um teste."));
    for (const [z, dados] of Object.entries(zonas[chave].zonas)) {
      const linha = el("div", "zona");
      linha.append(el("span", null, `${z.toUpperCase()} ${dados.nome}`), el("span", null, `${dados.min}–${dados.max} bpm`));
      bloco.append(linha);
    }
    $("zonas").append(bloco);
  }
  const natacao = el("div");
  natacao.append(el("p", "zonas-titulo", "Natação"), el("p", "discreto", `Sem zonas de FC. Ritmo típico: ${zonas.natacao.ritmo_tipico_min_100m} por 100 m.`));
  $("zonas").append(natacao);
}

// Os dados vivem no ramo "dados" do repositório privado. Esta página é pública
// e não traz dado nenhum: lê-os com a chave de acesso guardada neste browser.
const REPOSITORIO = "erykssousa/AI-TRI";
const URL_PAINEL = `https://api.github.com/repos/${REPOSITORIO}/contents/painel.json?ref=dados`;
const GUARDADA = "aitri_chave";
// No PC, em desenvolvimento, lê-se o ficheiro local (?remoto=1 força o modo real).
const LOCAL = ["localhost", "127.0.0.1"].includes(location.hostname) && !new URLSearchParams(location.search).has("remoto");

class SemAcesso extends Error {}

function lerChave() {
  try { return localStorage.getItem(GUARDADA); } catch { return null; }
}

async function obterPainel() {
  if (LOCAL) {
    const resposta = await fetch("dados/painel.json", { cache: "no-store" });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    return resposta.json();
  }
  const chave = lerChave();
  if (!chave) throw new SemAcesso("");
  const resposta = await fetch(URL_PAINEL, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${chave}`, Accept: "application/vnd.github.raw+json", "X-GitHub-Api-Version": "2022-11-28" },
  });
  if (resposta.status === 401) throw new SemAcesso("A chave não é válida ou expirou. Cria uma nova e cola-a aqui.");
  if (resposta.status === 403 || resposta.status === 404) {
    throw new SemAcesso("A chave não dá acesso aos dados. Confirma que é só para o repositório AI-TRI, com permissão de leitura em Contents, e que o sync já correu.");
  }
  if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
  return resposta.json();
}

function pedirChave(mensagem) {
  $("sync").textContent = "";
  $("conteudo").hidden = true;
  $("rodape").hidden = true;
  $("erro").textContent = mensagem;
  $("erro").hidden = !mensagem;
  $("acesso").hidden = false;
}

// ---- Chat -------------------------------------------------------------
// Cada mensagem ou decisão dispara um workflow no repositório privado. A
// resposta chega quando o workflow publica um painel novo (cerca de um minuto).
const URL_ACAO = `https://api.github.com/repos/${REPOSITORIO}/actions/workflows/acao.yml/dispatches`;
const ESPERA_MS = 8000;
const ESPERA_MAXIMA_MS = 5 * 60 * 1000;
let ocupado = false;

// Muda sempre que uma ação teve efeito: mensagem nova, proposta decidida,
// plano proposto ou aprovado.
const assinatura = (painel) => JSON.stringify([
  (painel.conversa || []).map((m) => [m.id, m.estado]),
  painel.proposta_plano ? [painel.proposta_plano.semana, painel.proposta_plano.sessoes.map((s) => s.id + s.minutos)] : null,
  painel.plano ? [painel.plano.semana, painel.plano.sessoes.length] : null,
]);

function mostrarProposta(proposta) {
  $("s-proposta").hidden = !proposta;
  if (!proposta) return;
  const segunda = new Date(`${proposta.semana}T12:00:00`);
  $("t-proposta").textContent = `Plano proposto para a semana de ${segunda.getDate()}/${segunda.getMonth() + 1}`;
  $("proposta-notas").textContent = proposta.notas;
  $("proposta-alvos").textContent = `Alvos: ${proposta.alvos.join(" · ")}`;
  mostrarPlano(proposta, $("proposta"));
}

$("plano-aprovar").addEventListener("click", () => agir({ tipo: "plano_aprovar" }, "A enviar o plano para o relógio e o calendário (um a dois minutos)…"));
$("plano-outro").addEventListener("click", () => agir({ tipo: "plano_propor" }, "O treinador está a desenhar outro plano (dois a três minutos)…"));

function mostrarConversa(conversa) {
  const caixa = $("conversa");
  for (const m of conversa || []) {
    caixa.append(el("div", `balao ${m.autor}`, m.texto));
    if (!m.alteracoes.length) continue;
    const proposta = el("div", "proposta");
    proposta.append(el("strong", null, "Alterações propostas"));
    const lista = el("ul");
    for (const a of m.alteracoes) lista.append(el("li", null, a));
    proposta.append(lista);
    if (m.estado === "pendente") {
      const decisao = el("div", "decisao");
      const sim = el("button", "principal", "Aprovar");
      const nao = el("button", null, "Rejeitar");
      sim.type = nao.type = "button";
      sim.addEventListener("click", () => agir({ tipo: "aprovar", id: String(m.id) }, "A aplicar no relógio e no calendário…"));
      nao.addEventListener("click", () => agir({ tipo: "rejeitar", id: String(m.id) }, "A registar…"));
      decisao.append(sim, nao);
      proposta.append(decisao);
    } else {
      const rotulos = { aprovada: "Aprovada e aplicada.", rejeitada: "Rejeitada.", falhou: "Não foi aplicada por completo." };
      proposta.append(el("p", "feito", rotulos[m.estado] || ""));
    }
    caixa.append(proposta);
  }
}

function bloquear(sim) {
  ocupado = sim;
  for (const botao of document.querySelectorAll("#chat button, .decisao button, #checkin button")) botao.disabled = sim;
  $("mensagem").disabled = sim;
}

async function agir(inputs, aviso) {
  if (ocupado) return;
  if (LOCAL) { $("estado-chat").textContent = "No PC o chat está desligado: só funciona na app publicada."; return; }
  bloquear(true);
  $("estado-chat").textContent = aviso;
  const antes = assinatura(ultimoPainel);
  try {
    const resposta = await fetch(URL_ACAO, {
      method: "POST",
      headers: { Authorization: `Bearer ${lerChave()}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
      body: JSON.stringify({ ref: "main", inputs }),
    });
    if (resposta.status === 403 || resposta.status === 404) {
      throw new Error("a chave não tem permissão para pedir ações (falta 'Actions: Read and write')");
    }
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);

    const limite = Date.now() + ESPERA_MAXIMA_MS;
    while (Date.now() < limite) {
      await new Promise((r) => setTimeout(r, ESPERA_MS));
      const painel = await obterPainel().catch(() => null);
      if (painel && assinatura(painel) !== antes) {
        desenhar(painel);
        $("estado-chat").textContent = "";
        if (inputs.tipo === "mensagem") $("mensagem").value = "";
        return;
      }
    }
    $("estado-chat").textContent = "Ainda sem resposta. Atualiza a página daqui a um minuto.";
  } catch (erro) {
    $("estado-chat").textContent = `Não foi possível enviar: ${erro.message}.`;
  } finally {
    bloquear(false);
  }
}

$("chat").addEventListener("submit", (evento) => {
  evento.preventDefault();
  const texto = $("mensagem").value.trim();
  if (!texto || ocupado) return;
  if (!LOCAL) $("conversa").append(el("div", "balao eryk", texto));
  agir({ tipo: "mensagem", texto }, "O treinador está a responder (cerca de um minuto)…");
});

// ---- Check-in ---------------------------------------------------------
for (const grupo of document.querySelectorAll(".escala")) {
  const opcoes = el("div", "opcoes");
  for (let n = 1; n <= 5; n += 1) {
    const entrada = el("input");
    entrada.type = "radio";
    entrada.name = grupo.dataset.nome;
    entrada.value = n;
    entrada.id = `${grupo.dataset.nome}-${n}`;
    entrada.required = true;
    const rotulo = el("label", null, String(n));
    rotulo.htmlFor = entrada.id;
    opcoes.append(entrada, rotulo);
  }
  const extremos = el("div", "extremos");
  extremos.append(el("span", null, "má"), el("span", null, "ótima"));
  grupo.append(opcoes, extremos);
}
$("c-dores").addEventListener("change", () => { $("c-dores-onde").hidden = $("c-dores").value === "nenhumas"; });
$("c-tempo").addEventListener("change", () => { $("c-minutos").hidden = $("c-tempo").value !== "menos"; });

function mostrarCheckin(painel) {
  $("s-checkin").hidden = Boolean(painel.checkin_feito);
  // Só se pergunta pelas horas de sono se o relógio não as tiver.
  const hoje = painel.saude[painel.saude.length - 1];
  $("campo-sono").hidden = hoje.sono_horas !== null;
}

$("checkin").addEventListener("submit", (evento) => {
  evento.preventDefault();
  const escolhido = (nome) => Number(document.querySelector(`input[name="${nome}"]:checked`).value);
  const respostas = {
    sono_horas: $("campo-sono").hidden || $("c-sono").value === "" ? null : Number($("c-sono").value),
    sono_qualidade: escolhido("sono_qualidade"),
    energia: escolhido("energia"),
    motivacao: escolhido("motivacao"),
    dores: $("c-dores").value,
    dores_onde: $("c-dores").value === "nenhumas" ? "" : $("c-dores-onde").value,
    tempo: $("c-tempo").value,
    tempo_minutos: $("c-tempo").value === "menos" && $("c-minutos").value !== "" ? Number($("c-minutos").value) : null,
    treinos_sem_relogio: $("c-sem-relogio").value,
  };
  agir({ tipo: "checkin", texto: JSON.stringify(respostas) }, "Check-in enviado. O treinador está a ver o teu dia (cerca de um minuto)…");
  $("t-chat").scrollIntoView({ behavior: "smooth" });
});

// ---- Arranque ---------------------------------------------------------
let ultimoPainel = {};

function desenhar(painel) {
  ultimoPainel = painel;
  for (const id of ["plano", "proposta", "conversa", "hoje", "grafico", "semana", "atividades", "zonas"]) $(id).replaceChildren();
  $("tabela-fc").querySelector("tbody").replaceChildren();
  $("aviso-relogio").hidden = true;
  const sync = painel.ultimo_sync ? `${dataCurta(painel.ultimo_sync)} às ${painel.ultimo_sync.slice(11, 16)}` : "nunca";
  $("sync").textContent = `Última sincronização com o Garmin: ${sync}`;
  mostrarCheckin(painel);
  mostrarPlano(painel.plano);
  mostrarProposta(painel.proposta_plano);
  mostrarConversa(painel.conversa);
  mostrarHoje(painel.saude);
  mostrarGrafico(painel.saude);
  mostrarSemana(painel.semana);
  mostrarAtividades(painel.atividades);
  mostrarZonas(painel.zonas);
}

async function arrancar() {
  try {
    const painel = await obterPainel();
    desenhar(painel);
    $("acesso").hidden = true;
    $("conteudo").hidden = false;
    $("rodape").hidden = LOCAL;
  } catch (erro) {
    if (erro instanceof SemAcesso) { pedirChave(erro.message); return; }
    $("sync").textContent = `Não foi possível carregar os dados (${erro.message}). Verifica a ligação à internet.`;
  }
}

$("acesso").addEventListener("submit", (evento) => {
  evento.preventDefault();
  try {
    localStorage.setItem(GUARDADA, $("chave").value.trim());
  } catch {
    pedirChave("Este browser não deixa guardar a chave (modo privado?).");
    return;
  }
  $("chave").value = "";
  $("sync").textContent = "A carregar…";
  arrancar();
});
$("sair").addEventListener("click", () => {
  try { localStorage.removeItem(GUARDADA); } catch { /* nada a remover */ }
  location.reload();
});

arrancar();
