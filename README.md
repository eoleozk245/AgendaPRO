# AgendaPRO

Plataforma de agendamento de serviços para barbearias e salões. O estabelecimento gerencia agenda, serviços, horários e clientes; o cliente final reserva pela página pública `/{endereço}`, que mostra só horários realmente livres.

Projeto de portfólio com qualidade de produto real. Situação atual em [`docs/STATUS.md`](docs/STATUS.md).

## Stack

React 19 + TypeScript + Vite · Supabase (PostgreSQL, Auth, RLS) · Zod · react-router · Vitest + Testing Library · Playwright + axe-core · pgTAP · ESLint + Prettier · GitHub Actions.

## Como rodar

Requisitos: Node.js 22+.

```bash
npm install
cp .env.example .env.local   # preencha com a URL e a chave publicável do Supabase
npm run dev
```

O banco precisa estar com todas as migrações de `supabase/migrations/` aplicadas, em ordem (ver [`docs/DATABASE.md`](docs/DATABASE.md)).

## Comandos

```bash
npm run dev          # servidor de desenvolvimento
npm run build        # verifica tipos e gera a versão de produção em dist/
npm run typecheck    # só verifica os tipos
npm run lint         # ESLint
npm run format       # formata com Prettier
npm run format:check # confere a formatação
npm test             # testes do app (Vitest)
npm run test:db      # aplica as migrações num PostgreSQL temporário e roda os testes pgTAP
npm run test:e2e     # testes de navegador (Playwright) com o Supabase simulado
```

`npm run test:db` precisa de PostgreSQL 15+ e pgTAP instalados (ex.: `apt install postgresql-16 postgresql-16-pgtap`).

`npm run test:e2e` usa o Playwright (`@playwright/test`) com o Chromium dele (`npx playwright install chromium` na primeira vez) e o `@axe-core/playwright` para checar acessibilidade em cada tela. As respostas do Supabase são simuladas: não precisa de banco nem de chave.

## Documentação

- [`CLAUDE.md`](CLAUDE.md): instruções do projeto
- [`docs/DECISIONS.md`](docs/DECISIONS.md): decisões e pendências
- [`docs/STATUS.md`](docs/STATUS.md): o que existe e o que falta
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): organização do código
- [`docs/DATABASE.md`](docs/DATABASE.md): tabelas, funções, migrações e testes do banco
- [`docs/SECURITY.md`](docs/SECURITY.md): chaves, RLS, limites e cabeçalhos
- [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md): tokens e componentes
