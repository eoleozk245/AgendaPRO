# AgendaPRO — Estado atual

Última atualização: 26/10/2026

## Etapas

| Etapa                                          | Situação                                                   |
| ---------------------------------------------- | ---------------------------------------------------------- |
| 1. Fundação                                    | Feita                                                      |
| 2. Autenticação, organização, RLS e isolamento | Feita (com ajustes de painel pendentes, ver `SECURITY.md`) |
| 3. Serviços, horários e clientes               | A fazer                                                    |
| 4. Agenda, conflitos e estados                 | A fazer                                                    |
| 5. Página pública de agendamento               | A fazer                                                    |
| 6. Acessibilidade, testes finais e publicação  | A fazer                                                    |

## O que existe de fato

- Login, cadastro (com confirmação por e-mail) e saída.
- Cadastro do estabelecimento (nome + endereço público), com um painel inicial provisório.
- Banco: `organizations` e `memberships`, com RLS (ver `DATABASE.md`).
- Design system: tokens claro/escuro, troca de tema e componentes base.

## Verificações da última mudança

- `typecheck`, `lint`, `format:check` e `build`: sem erros.
- `npm test`: todos os testes passando (o número exato está no último commit/PR).
- pgTAP `organizations_isolation.test.sql` no projeto remoto: **16/16 ok**.
- Supabase Advisor: um aviso de segurança, aceito e explicado em `SECURITY.md`. Nenhum aviso de desempenho.
- Fluxo de ponta a ponta com Playwright contra o Supabase real (celular, tema escuro): senha errada mostra mensagem, login, criação do estabelecimento, recarregar mantém a sessão, saída. axe-core sem violações nas três telas, sem rolagem horizontal em 320 e 390 px.
- **Não verificado:** o envio real do e-mail de confirmação (o teste usou um usuário já confirmado).
