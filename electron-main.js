const { app, BrowserWindow, ipcMain, shell, clipboard, dialog } = require("electron");
const path = require("path");

const API_BASE_URL = process.env.API_BASE_URL || "";

// A API do serviço externo trabalha com paginação. Mantemos o tamanho já conhecido
// no fluxo atual e percorremos as páginas até receber todas as contas.
const ACCOUNTS_PAGE_SIZE = 10;
const MAX_ACCOUNT_PAGES = 100;

const BLOCKED_HEADERS = new Set([
  "host", "content-length", "connection", "origin", "referer", "user-agent",
  "sec-ch-ua", "sec-ch-ua-mobile", "sec-ch-ua-platform", "sec-fetch-dest",
  "sec-fetch-mode", "sec-fetch-site", "priority", "accept-encoding"
]);

// Extrai somente a URL original do cURL copiado pelo DevTools.
// A URL NÃO é usada como destino da requisição. Ela serve apenas para descobrir
// se o cURL da listagem de contas já contém um parâmetro ?query=...
function extractRequestUrl(normalizedCurl) {
  const urlOptionMatch = normalizedCurl.match(
    /(?:--url)\s+(?:'([^']+)'|"([^"]+)"|(https?:\/\/\S+))/i
  );

  if (urlOptionMatch) {
    return urlOptionMatch[1] || urlOptionMatch[2] || urlOptionMatch[3] || "";
  }

  // Formato comum do Chrome em "Copy as cURL (bash)":
  // curl 'https://api.../accounts?...&query=EmpresaExemplo' \
  const directUrlMatch = normalizedCurl.match(
    /^\s*curl(?:\.exe)?\s+(?:'([^']+)'|"([^"]+)"|(https?:\/\/\S+))/i
  );

  return directUrlMatch
    ? (directUrlMatch[1] || directUrlMatch[2] || directUrlMatch[3] || "")
    : "";
}

// Descobre o query pesquisado no serviço externo quando o cURL veio especificamente
// de /accounts. Se não existir query, devolvemos string vazia
// e a aplicação consultará todas as contas permitidas.
function extractAccountTerm(normalizedCurl) {
  const requestUrl = extractRequestUrl(normalizedCurl);
  if (!requestUrl) return "";

  try {
    const parsedUrl = new URL(requestUrl);

    if (!parsedUrl.pathname.includes("/accounts")) {
      return "";
    }

    return String(parsedUrl.searchParams.get("query") || "").trim();
  } catch {
    // Um cURL válido para autenticação pode ter vindo de outro formato/endpoint.
    // Nesse caso, não bloqueamos o fluxo: simplesmente buscamos todas as contas.
    return "";
  }
}

// Interpreta somente os dados necessários do cURL e mantém tudo em memória.
// Nenhum cookie, Authorization ou cURL completo é persistido em arquivo ou banco.
function parseCurl(curlText) {
  if (!curlText || typeof curlText !== "string") {
    throw new Error("Informe uma requisição cURL válida.");
  }

  const normalized = curlText.replace(/\\\r?\n/g, " ");
  const headers = {};
  const headerRegex = /(?:-H|--header)\s+(?:'([^']*)'|"([^"]*)")/g;
  let match;

  while ((match = headerRegex.exec(normalized)) !== null) {
    const headerLine = match[1] || match[2] || "";
    const separatorIndex = headerLine.indexOf(":");
    if (separatorIndex === -1) continue;

    const name = headerLine.slice(0, separatorIndex).trim().toLowerCase();
    const value = headerLine.slice(separatorIndex + 1).trim();

    if (name && value && !BLOCKED_HEADERS.has(name)) {
      headers[name] = value;
    }
  }

  const cookieMatch = normalized.match(/(?:-b|--cookie)\s+(?:'([^']*)'|"([^"]*)")/);
  if (cookieMatch) headers.cookie = cookieMatch[1] || cookieMatch[2];

  if (!headers.cookie && !headers.authorization) {
    throw new Error("Não encontrei cookies ou Authorization no cURL informado.");
  }

  return {
    headers,
    accountTerm: extractAccountTerm(normalized)
  };
}

async function callserviço externo(apiPath, { method = "GET", headers = {}, body } = {}) {
  // O destino sempre usa a URL fixa abaixo. Nunca fazemos fetch para a URL
  // arbitrária que foi colada dentro do cURL.
  const response = await fetch(`${API_BASE_URL}${apiPath}`, {
    method,
    headers: {
      accept: "application/json, text/plain, */*",
      ...headers,
      ...(body ? { "content-type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const error = new Error(`A API respondeu com HTTP ${response.status}.`);
    error.status = response.status;
    error.details = data;
    throw error;
  }

  return { status: response.status, data };
}

// Algumas APIs usam nomes diferentes para o total de registros.
function getTotalAccounts(data) {
  const candidates = [data?.total, data?.totalElements, data?.totalItems];

  for (const value of candidates) {
    const total = Number(value);
    if (Number.isFinite(total) && total >= 0) return total;
  }

  return null;
}

// Busca todas as páginas para o query recebido.
// - query vazio: carrega todas as contas permitidas;
// - query preenchido: carrega todas as contas que correspondem à pesquisa do cURL.
async function fetchAllAllowedAccounts(headers, term = "") {
  const cleanTerm = String(term || "").trim();
  const query = encodeURIComponent(cleanTerm);
  const collected = [];
  let expectedTotal = null;
  let lastStatus = 200;

  for (let page = 0; page < MAX_ACCOUNT_PAGES; page += 1) {
    const apiPath = `/accounts?page=${page}&size=${ACCOUNTS_PAGE_SIZE}&query=${query}`;
    const result = await callserviço externo(apiPath, { headers });
    lastStatus = result.status;

    const pageItems = Array.isArray(result.data?.items) ? result.data.items : [];

    if (page === 0) {
      expectedTotal = getTotalAccounts(result.data);
    }

    collected.push(...pageItems);

    // Quando a API informa o total, paramos ao atingir a quantidade esperada.
    if (expectedTotal !== null && collected.length >= expectedTotal) {
      break;
    }

    // Sem total informado, uma página incompleta indica o final.
    if (expectedTotal === null && pageItems.length < ACCOUNTS_PAGE_SIZE) {
      break;
    }

    if (pageItems.length === 0) {
      break;
    }

    if (page === MAX_ACCOUNT_PAGES - 1) {
      throw new Error("A lista de contas excedeu o limite de páginas esperado.");
    }
  }

  // Evita mostrar a mesma conta duas vezes caso haja repetição entre páginas.
  const uniqueAccounts = [];
  const seenIds = new Set();

  for (const account of collected) {
    const key = String(account?.id ?? "");
    if (!key || seenIds.has(key)) continue;

    seenIds.add(key);
    uniqueAccounts.push(account);
  }

  return {
    status: lastStatus,
    items: uniqueAccounts,
    total: expectedTotal ?? uniqueAccounts.length
  };
}

function safeError(error) {
  return {
    ok: false,
    message: error.message || "Erro inesperado.",
    status: error.status || 400,
    details: error.details
  };
}

// Fluxo unificado:
// 1) se o cURL tiver ?query=..., reaproveitamos esse filtro;
// 2) se não tiver query, carregamos todas as contas;
// 3) uma conta => seleção automática;
// 4) duas ou mais => frontend exibe pesquisa/seleção.
ipcMain.handle("auth:validate", async (_event, { curl }) => {
  try {
    const { headers, accountTerm } = parseCurl(curl);
    const result = await fetchAllAllowedAccounts(headers, accountTerm);
    const items = result.items;

    if (items.length === 0) {
      if (accountTerm) {
        throw new Error(`Nenhuma conta foi encontrada para a pesquisa "${accountTerm}".`);
      }

      throw new Error("Nenhuma conta permitida foi encontrada para esta autenticação.");
    }

    const mode = items.length === 1 ? "single" : "multiple";

    return {
      ok: true,
      status: result.status,
      mode,
      account: mode === "single" ? items[0] : null,
      items,
      total: items.length,
      filteredByCurl: Boolean(accountTerm)
    };
  } catch (error) {
    return safeError(error);
  }
});

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

ipcMain.handle("boleto:generate", async (_event, payload) => {
  try {
    const { curl, accountId, valor, dataVencimento } = payload;

    if (!accountId) throw new Error("Selecione uma conta.");
    if (!Number.isFinite(Number(valor)) || Number(valor) <= 0) {
      throw new Error("Informe um valor maior que zero.");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dataVencimento || ""))) {
      throw new Error("Informe uma data de vencimento válida.");
    }

    const { headers } = parseCurl(curl);
    const boletoPath = `/accounts/${encodeURIComponent(accountId)}/documents`;
    const creation = await callserviço externo(boletoPath, {
      method: "POST",
      headers,
      body: { valor: Number(valor), dataVencimento }
    });

    const documentId = creation.data?.documentId;
    if (!documentId) {
      const error = new Error("A API não retornou documentId.");
      error.details = creation.data;
      throw error;
    }

    // O PDF pode levar alguns segundos para ficar disponível. Consultamos
    // o MESMO boleto até 5 vezes, sem criar boletos adicionais.
    let lastError;

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      if (attempt > 1) await wait(2000);

      try {
        const query = `?documentId=${encodeURIComponent(documentId)}`;
        const pdf = await callserviço externo(`${boletoPath}${query}`, { headers });

        if (pdf.data?.url) {
          return {
            ok: true,
            documentId,
            url: pdf.data.url,
            diagnostics: {
              criacao: creation.status,
              consultaPdf: pdf.status,
              tentativasPdf: attempt
            }
          };
        }

        lastError = new Error("A API não retornou a URL do boleto.");
        lastError.details = pdf.data;
      } catch (error) {
        lastError = error;
      }
    }

    const error = new Error("O boleto foi criado, mas o PDF ainda não pôde ser consultado.");
    error.status = lastError?.status;
    error.details = {
      documentId,
      respostaConsulta: lastError?.details
    };
    throw error;
  } catch (error) {
    return safeError(error);
  }
});

ipcMain.handle("external:open", async (_event, url) => {
  if (typeof url !== "string" || !url.startsWith("https://")) {
    throw new Error("Link inválido.");
  }

  await shell.openExternal(url);
  return true;
});

ipcMain.handle("clipboard:write", (_event, text) => {
  clipboard.writeText(String(text || ""));
  return true;
});

function createWindow() {
  const window = new BrowserWindow({
    width: 1120,
    height: 820,
    minWidth: 900,
    minHeight: 650,
    autoHideMenuBar: true,
    title: "Gerador de Boletos",
    // Ícone exibido na janela e na barra de tarefas do Windows.
    icon: path.join(__dirname, "public", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  // Carrega o HTML diretamente de dentro do aplicativo.
  // Não existe servidor localhost nem dependência da pasta onde o .exe foi aberto.
  window.loadFile(path.join(__dirname, "public", "index.html"));

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(createWindow).catch(error => {
  dialog.showErrorBox("Erro ao iniciar", error.message);
  app.quit();
});

app.on("window-all-closed", () => app.quit());
