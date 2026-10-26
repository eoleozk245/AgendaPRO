# AgendaPRO — Estado atual

Última atualização: 26/10/2026

## Etapa atual: 1 — Fundação (pronta para revisão)

| Item                                                            | Situação                     |
| --------------------------------------------------------------- | ---------------------------- |
| Repositório e documentação base                                 | Feito                        |
| Projeto Vite + React + TypeScript, ESLint, Prettier, Vitest     | Feito                        |
| Tokens de design claro e escuro, com teste de contraste         | Feito                        |
| Troca de tema (Sistema, Claro, Escuro) com preferência salva    | Feito                        |
| Componentes: Button, TextField, Alert, Badge, Card, ThemeToggle | Feito                        |
| Componentes: modal, menu, tabela                                | Adiado até uma tela precisar |

## O que existe de fato

- Uma página temporária, "Fundação visual" (`src/features/design-preview/`), que mostra os componentes com dados de exemplo. Ela sai quando as telas reais existirem.
- Ainda não tem Supabase, autenticação, banco, migrações nem telas do produto.

## Verificações da última mudança

- `typecheck`, `lint`, `format:check` e `build`: sem erros.
- `npm test`: 75 testes passando (56 deles são de contraste).
- Conferência manual com Playwright em Chromium (desktop e celular, temas claro e escuro): axe-core sem violações, sem rolagem horizontal, troca de tema por teclado e preferência mantida ao recarregar.
- Ainda não existe CI no GitHub.

## Próximo passo (Etapa 2)

Autenticação, organização, RLS e testes de isolamento. Antes, precisa decidir onde o Supabase vai rodar: um projeto na nuvem (plano gratuito) e/ou o Supabase local com Docker para desenvolvimento.
