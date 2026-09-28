# Gerador de Boletos — versão pública de portfólio

Projeto desktop desenvolvido com **Electron, JavaScript, HTML e CSS** para demonstrar um fluxo de interface que identifica uma conta, recebe valor e vencimento e acompanha a geração de um documento de cobrança.

> **Importante:** esta é uma versão sanitizada para portfólio. Nomes de empresa, domínio, endpoints, identificadores, exemplos e detalhes da integração corporativa original foram removidos ou substituídos. O repositório público não contém credenciais nem deve ser usado para acessar sistemas privados.

## Objetivo do projeto

O projeto foi criado como exercício prático de desenvolvimento desktop e integração HTTP. Ele demonstra:

- aplicação desktop com Electron;
- comunicação segura entre renderer e processo principal via `contextBridge`/IPC;
- interpretação controlada de dados de uma requisição fornecida pelo usuário;
- paginação de resultados;
- fluxo de conta única ou seleção entre múltiplas contas;
- validação de valor e vencimento;
- chamada HTTP para criação de uma operação;
- consulta com tentativas limitadas até o documento ficar disponível;
- abertura de link HTTPS no navegador.

## Arquitetura

```text
public/index.html + public/app.js
              |
              v
          preload.js
              | IPC
              v
       electron-main.js
              | HTTPS
              v
      API externa configurável
```

O renderer não recebe acesso direto ao Node.js. O `preload.js` expõe apenas as operações necessárias e a janela utiliza `nodeIntegration: false`, `contextIsolation: true` e `sandbox: true`.

## Tecnologias

- JavaScript (Vanilla JS)
- HTML5
- CSS3
- Electron 37.4.0
- Node.js (runtime utilizado pelo Electron)
- Fetch API / HTTP
- IPC do Electron
- npm
- electron-builder 26.0.12

## Estrutura

```text
.
├── electron-main.js   # Processo principal, validações e integração HTTP
├── preload.js         # Ponte controlada entre interface e Electron
├── public/
│   ├── index.html     # Estrutura da interface
│   ├── app.js         # Comportamento da tela
│   ├── style.css      # Estilos
│   └── icon.png
├── build/             # Recursos usados no empacotamento
├── package.json
├── .env.example       # Somente exemplo; não contém configuração real
└── SECURITY.md
```

## Executar localmente

Pré-requisitos: Node.js e npm.

```bash
npm install
npm start
```

A versão pública **não inclui o endereço da API privada**. `API_BASE_URL` precisa ser fornecida somente em um ambiente autorizado. O valor presente em `.env.example` usa o domínio reservado `example.invalid` e não representa um serviço real.

## Build para Windows

```bash
npm run build:portable
```

Os artefatos de build são ignorados pelo Git.

## Segurança e privacidade

Não publique no repositório:

- cURL copiado de ambiente autenticado;
- `Authorization`, Bearer tokens ou API keys;
- cookies e sessões;
- URLs/domínios privados;
- nomes ou IDs de clientes/contas;
- respostas reais da API;
- screenshots contendo informações corporativas;
- arquivos `.env`;
- logs de produção.

O projeto mantém dados de autenticação apenas em memória durante a execução. Para um produto de produção, a autenticação deve ser integrada ao mecanismo oficial da plataforma, em vez de depender de cURL fornecido pelo usuário.

## Limitações da versão pública

A integração original foi propositalmente descaracterizada. Os caminhos HTTP presentes nesta versão são exemplos genéricos e não documentam a API corporativa original. Consequentemente, clonar este repositório não fornece acesso nem uma integração pronta com qualquer ambiente privado.

## Aviso

Este repositório é disponibilizado para fins educacionais e de portfólio. Não representa documentação oficial de nenhuma empresa ou serviço externo.
