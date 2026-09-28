// Referências dos elementos usados na interface.
const curlInput = document.querySelector("#curlInput");
const validateButton = document.querySelector("#validateButton");
const authStatus = document.querySelector("#authStatus");
const boletoSection = document.querySelector("#boletoSection");
const accountPrompt = document.querySelector("#accountPrompt");

// Bloco usado quando existe exatamente uma conta.
const singleAccountContext = document.querySelector("#singleAccountContext");
const singleAccountName = document.querySelector("#singleAccountName");
const singleAccountDetails = document.querySelector("#singleAccountDetails");

// Bloco usado quando existem duas ou mais contas.
const multipleAccountContext = document.querySelector("#multipleAccountContext");
const accountCombobox = document.querySelector("#accountCombobox");
const accountInput = document.querySelector("#accountInput");
const accountToggle = document.querySelector("#accountToggle");
const accountOptions = document.querySelector("#accountOptions");
const accountCount = document.querySelector("#accountCount");
const selectedAccountDetails = document.querySelector("#selectedAccountDetails");

const valueInput = document.querySelector("#valueInput");
const dueDateInput = document.querySelector("#dueDateInput");
const generateButton = document.querySelector("#generateButton");
const generationStatus = document.querySelector("#generationStatus");
const successSection = document.querySelector("#successSection");
const successSummary = document.querySelector("#successSummary");
const openButton = document.querySelector("#openButton");
const copyButton = document.querySelector("#copyButton");
const anotherButton = document.querySelector("#anotherButton");
const diagnostics = document.querySelector("#diagnostics");
const diagnosticsContent = document.querySelector("#diagnosticsContent");

// Estado temporário. Tudo permanece apenas em memória enquanto a aplicação está aberta.
let accounts = [];
let selectedAccount = null;
let accountMode = ""; // "single" ou "multiple"
let activeOptionIndex = -1;
let validatedCurl = "";
let boletoUrl = "";

// Mostra uma mensagem de status na interface.
function showStatus(element, type, message) {
  element.className = `status ${type}`;
  element.textContent = message;
}

// Esconde uma mensagem de status.
function hideStatus(element) {
  element.className = "status hidden";
  element.textContent = "";
}

// Executa uma operação exposta pelo preload e converte respostas de erro
// em exceções JavaScript mais simples de tratar no frontend.
async function runOperation(operation) {
  const data = await operation();

  if (!data || !data.ok) {
    const error = new Error(data?.message || "Não foi possível concluir a operação.");
    error.details = data?.details;
    error.status = data?.status;
    throw error;
  }

  return data;
}

// Define o nome principal usado para mostrar uma conta na tela.
function getAccountLabel(account) {
  return account?.nomeEmpresa || account?.descricao || String(account?.id || "Conta sem identificação");
}

// Cria um texto secundário com informações que ajudam a confirmar a conta.
function getAccountDetailsText(account) {
  const details = [];

  if (account?.descricao && account.descricao !== getAccountLabel(account)) {
    details.push(account.descricao);
  }
  if (account?.status) details.push(`Status: ${account.status}`);
  if (account?.versao) details.push(`Versão: ${account.versao}`);

  return details.join(" • ");
}

// Normaliza a pesquisa para que "Médicos" e "medicos" sejam equivalentes.
function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// Verifica se uma conta combina com o texto digitado.
function accountMatches(account, searchText) {
  const query = normalizeText(searchText);
  if (!query) return true;

  const searchableText = normalizeText([
    account?.nomeEmpresa,
    account?.descricao,
    account?.id
  ].filter(Boolean).join(" "));

  return searchableText.includes(query);
}

function getFilteredAccounts() {
  return accounts.filter(account => accountMatches(account, accountInput.value));
}

// Atualiza a quantidade mostrada abaixo do campo de múltiplas contas.
function updateAccountCount(visibleCount = accounts.length) {
  if (accountMode !== "multiple") {
    accountCount.textContent = "";
    return;
  }

  if (!accounts.length) {
    accountCount.textContent = "Nenhuma conta disponível.";
    return;
  }

  if (selectedAccount) {
    accountCount.textContent = `${accounts.length} conta(s) disponível(is).`;
    return;
  }

  if (normalizeText(accountInput.value)) {
    accountCount.textContent = `${visibleCount} de ${accounts.length} conta(s).`;
    return;
  }

  accountCount.textContent = `${accounts.length} conta(s) disponível(is).`;
}

function showAccountOptions() {
  if (accountMode !== "multiple") return;

  accountOptions.classList.remove("hidden");
  accountInput.setAttribute("aria-expanded", "true");
}

function hideAccountOptions() {
  accountOptions.classList.add("hidden");
  accountInput.setAttribute("aria-expanded", "false");
  activeOptionIndex = -1;
}

// Marca uma opção para navegação pelas setas do teclado.
function setActiveOption(index) {
  const options = Array.from(accountOptions.querySelectorAll(".account-option"));

  options.forEach(option => option.classList.remove("active"));

  if (!options.length) {
    activeOptionIndex = -1;
    return;
  }

  const safeIndex = Math.max(0, Math.min(index, options.length - 1));
  activeOptionIndex = safeIndex;
  options[safeIndex].classList.add("active");
  options[safeIndex].scrollIntoView({ block: "nearest" });
}

// Limpa apenas a conta selecionada do modo múltiplo.
function clearSelectedAccount() {
  selectedAccount = null;
  selectedAccountDetails.classList.add("hidden");
  selectedAccountDetails.textContent = "";
}

// Seleciona uma conta quando o cURL retornou várias opções.
function selectAccount(account) {
  selectedAccount = account;
  accountInput.value = getAccountLabel(account);

  const details = getAccountDetailsText(account);
  if (details) {
    selectedAccountDetails.textContent = details;
    selectedAccountDetails.classList.remove("hidden");
  } else {
    selectedAccountDetails.classList.add("hidden");
    selectedAccountDetails.textContent = "";
  }

  accountPrompt.textContent = `Informe os dados para gerar um boleto para a conta ${getAccountLabel(account)}.`;
  updateAccountCount();
  hideAccountOptions();
  hideStatus(generationStatus);
}

// Desenha o dropdown usando apenas as contas que já foram carregadas em memória.
function renderAccountOptions({ showAll = false } = {}) {
  if (accountMode !== "multiple") return;

  const filteredAccounts = showAll ? accounts : getFilteredAccounts();

  accountOptions.innerHTML = "";
  activeOptionIndex = -1;

  if (!filteredAccounts.length) {
    const empty = document.createElement("div");
    empty.className = "account-empty";
    empty.textContent = "Nenhuma conta encontrada para essa pesquisa.";
    accountOptions.appendChild(empty);
    updateAccountCount(0);
    showAccountOptions();
    return;
  }

  for (const account of filteredAccounts) {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "account-option";
    option.setAttribute("role", "option");
    option.dataset.accountId = String(account.id);

    const title = document.createElement("span");
    title.className = "account-option-title";
    title.textContent = getAccountLabel(account);
    option.appendChild(title);

    if (account.descricao && account.descricao !== getAccountLabel(account)) {
      const subtitle = document.createElement("span");
      subtitle.className = "account-option-subtitle";
      subtitle.textContent = account.descricao;
      option.appendChild(subtitle);
    }

    // Evita que o input perca o foco antes do click selecionar a opção.
    option.addEventListener("mousedown", event => event.preventDefault());
    option.addEventListener("click", () => selectAccount(account));

    accountOptions.appendChild(option);
  }

  updateAccountCount(filteredAccounts.length);
  showAccountOptions();
}

// Configura a etapa 2 quando somente uma conta foi encontrada.
function renderSingleAccount(account) {
  accountMode = "single";
  selectedAccount = account;

  const label = getAccountLabel(account);
  const details = getAccountDetailsText(account);

  accountPrompt.textContent = `Informe os dados para gerar um boleto para a conta ${label}.`;
  singleAccountName.textContent = label;
  singleAccountDetails.textContent = details;

  singleAccountContext.classList.remove("hidden");
  multipleAccountContext.classList.add("hidden");
  hideAccountOptions();
}

// Configura a etapa 2 quando duas ou mais contas foram encontradas.
function renderMultipleAccounts() {
  accountMode = "multiple";
  clearSelectedAccount();

  accountInput.value = "";
  accountOptions.innerHTML = "";
  accountPrompt.textContent = `${accounts.length} contas encontradas. Pesquise ou selecione a conta desejada.`;

  singleAccountContext.classList.add("hidden");
  multipleAccountContext.classList.remove("hidden");
  hideAccountOptions();
  updateAccountCount(accounts.length);
}

// Invalida a etapa de boleto se o cURL for alterado após a validação.
// Assim não misturamos uma conta validada anteriormente com outro cURL.
function invalidateValidatedCurl() {
  accounts = [];
  selectedAccount = null;
  accountMode = "";
  activeOptionIndex = -1;
  validatedCurl = "";
  boletoUrl = "";

  accountInput.value = "";
  accountOptions.innerHTML = "";
  selectedAccountDetails.textContent = "";
  singleAccountName.textContent = "";
  singleAccountDetails.textContent = "";

  boletoSection.classList.add("hidden");
  singleAccountContext.classList.add("hidden");
  multipleAccountContext.classList.add("hidden");
  successSection.classList.add("hidden");
  diagnostics.classList.add("hidden");

  hideAccountOptions();
  hideStatus(authStatus);
  hideStatus(generationStatus);
}

curlInput.addEventListener("input", () => {
  if (!validatedCurl) return;

  if (curlInput.value.trim() !== validatedCurl) {
    invalidateValidatedCurl();
  }
});

// Valida a autenticação e decide automaticamente qual interface usar.
validateButton.addEventListener("click", async () => {
  const curl = curlInput.value.trim();

  if (!curl) {
    showStatus(authStatus, "error", "Cole o cURL antes de continuar.");
    return;
  }

  validateButton.disabled = true;
  showStatus(authStatus, "loading", "Validando autenticação e identificando as contas...");

  try {
    const result = await runOperation(() => window.boletoAPI.validarAutenticacao(curl));

    accounts = Array.isArray(result.items) ? result.items : [];
    validatedCurl = curl;
    boletoUrl = "";

    successSection.classList.add("hidden");
    diagnostics.classList.add("hidden");
    hideStatus(generationStatus);

    if (result.mode === "single" && result.account) {
      renderSingleAccount(result.account);
      showStatus(
        authStatus,
        "ok",
        `Autenticação válida. Conta identificada automaticamente: ${getAccountLabel(result.account)}.`
      );
    } else {
      renderMultipleAccounts();
      showStatus(
        authStatus,
        "ok",
        `Autenticação válida. ${accounts.length} conta(s) encontrada(s). Selecione a conta desejada.`
      );
    }

    boletoSection.classList.remove("hidden");
  } catch (error) {
    invalidateValidatedCurl();
    showStatus(authStatus, "error", error.message);
  } finally {
    validateButton.disabled = false;
  }
});

// Eventos do campo de pesquisa são úteis somente no modo de múltiplas contas.
accountInput.addEventListener("focus", () => {
  if (accountMode !== "multiple") return;

  // Quando já existe uma seleção, abrir novamente mostra todas as opções.
  renderAccountOptions({ showAll: Boolean(selectedAccount) });
});

accountInput.addEventListener("input", () => {
  if (accountMode !== "multiple") return;

  clearSelectedAccount();
  accountPrompt.textContent = `${accounts.length} contas encontradas. Pesquise ou selecione a conta desejada.`;
  renderAccountOptions();
});

accountToggle.addEventListener("click", () => {
  if (accountMode !== "multiple") return;

  if (accountOptions.classList.contains("hidden")) {
    accountInput.focus();
    renderAccountOptions({ showAll: true });
  } else {
    hideAccountOptions();
  }
});

// Navegação por teclado: setas, Enter e Escape.
accountInput.addEventListener("keydown", event => {
  if (accountMode !== "multiple") return;

  const options = Array.from(accountOptions.querySelectorAll(".account-option"));

  if (event.key === "ArrowDown") {
    event.preventDefault();
    if (accountOptions.classList.contains("hidden")) renderAccountOptions();
    setActiveOption(activeOptionIndex + 1);
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    if (accountOptions.classList.contains("hidden")) renderAccountOptions();
    setActiveOption(activeOptionIndex <= 0 ? 0 : activeOptionIndex - 1);
    return;
  }

  if (event.key === "Enter" && options.length) {
    event.preventDefault();
    const indexToUse = activeOptionIndex >= 0 ? activeOptionIndex : 0;
    options[indexToUse]?.click();
    return;
  }

  if (event.key === "Escape") {
    hideAccountOptions();
  }
});

// Fecha o dropdown ao clicar fora dele.
document.addEventListener("mousedown", event => {
  if (!accountCombobox.contains(event.target)) {
    hideAccountOptions();
  }
});

// Converte "R$ 5.000,65" para o número 5000.65.
function parseBrazilianMoney(text) {
  const cleaned = String(text)
    .replace(/R\$/gi, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^0-9.-]/g, "");

  return Number(cleaned);
}

function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

// Formata YYYY-MM-DD para DD/MM/YYYY sem conversão de fuso horário.
function formatDate(value) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

// Executa o fluxo completo: cria o boleto e depois consulta o PDF.
generateButton.addEventListener("click", async () => {
  const accountId = selectedAccount?.id;
  const valor = parseBrazilianMoney(valueInput.value);
  const dataVencimento = dueDateInput.value;

  if (!accountId) {
    const message = accountMode === "multiple"
      ? "Pesquise e selecione uma conta da lista."
      : "A conta não foi identificada. Valide o cURL novamente.";

    return showStatus(generationStatus, "error", message);
  }

  if (!validatedCurl) {
    return showStatus(generationStatus, "error", "Valide o cURL novamente antes de gerar o boleto.");
  }

  if (!Number.isFinite(valor) || valor <= 0) {
    return showStatus(generationStatus, "error", "Informe um valor válido.");
  }

  if (!dataVencimento) {
    return showStatus(generationStatus, "error", "Informe o vencimento.");
  }

  generateButton.disabled = true;
  successSection.classList.add("hidden");
  showStatus(generationStatus, "loading", "Gerando boleto e consultando o PDF...");

  try {
    const result = await runOperation(() => window.boletoAPI.gerarBoleto({
      // Usamos exatamente o cURL que foi validado para esta conta/lista.
      curl: validatedCurl,
      accountId,
      valor,
      dataVencimento
    }));

    boletoUrl = result.url;
    successSummary.textContent = `${getAccountLabel(selectedAccount)} • ${formatMoney(valor)} • Vencimento ${formatDate(dataVencimento)}`;
    successSection.classList.remove("hidden");
    hideStatus(generationStatus);

    diagnosticsContent.textContent = [
      "Autenticação: OK",
      `Conta: ${accountId}`,
      `Criação do boleto: HTTP ${result.diagnostics.criacao}`,
      `Identificador da operação: ${result.documentId}`,
      `Consulta do PDF: HTTP ${result.diagnostics.consultaPdf}`
    ].join("\n");
    diagnostics.classList.remove("hidden");
  } catch (error) {
    showStatus(generationStatus, "error", error.message);
    diagnosticsContent.textContent = `HTTP: ${error.status || "-"}\n\n${JSON.stringify(error.details || {}, null, 2)}`;
    diagnostics.classList.remove("hidden");
  } finally {
    generateButton.disabled = false;
  }
});

openButton.addEventListener("click", () => {
  if (boletoUrl) window.boletoAPI.abrirLink(boletoUrl);
});

copyButton.addEventListener("click", async () => {
  if (!boletoUrl) return;

  await window.boletoAPI.copiarTexto(boletoUrl);
  copyButton.textContent = "Link copiado ✓";

  setTimeout(() => {
    copyButton.textContent = "Copiar link";
  }, 1800);
});

// Mantém a autenticação e a conta atual para facilitar a geração de outro boleto.
anotherButton.addEventListener("click", () => {
  valueInput.value = "";
  dueDateInput.value = "";
  boletoUrl = "";
  successSection.classList.add("hidden");
  hideStatus(generationStatus);
  valueInput.focus();
});
