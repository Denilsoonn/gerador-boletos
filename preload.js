const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("boletoAPI", {
  // Valida o cURL e recebe o resultado já classificado como conta única ou múltiplas contas.
  validarAutenticacao: (curl) => ipcRenderer.invoke("auth:validate", { curl }),

  // Gera o boleto usando somente a conta já identificada/selecionada na interface.
  gerarBoleto: (payload) => ipcRenderer.invoke("boleto:generate", payload),

  abrirLink: (url) => ipcRenderer.invoke("external:open", url),
  copiarTexto: (text) => ipcRenderer.invoke("clipboard:write", text)
});
