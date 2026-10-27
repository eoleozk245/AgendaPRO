# AgendaPRO — Estado atual

Última atualização: 26/10/2026

## Etapas

| Etapa                                            | Código                    | No banco remoto                                      |
| ------------------------------------------------ | ------------------------- | ---------------------------------------------------- |
| 1. Fundação                                      | Feita                     | —                                                    |
| 2. Autenticação, organização, RLS, isolamento    | Feita                     | **Aplicada** e testada (pgTAP 16/16 no projeto real) |
| 3. Serviços, horários, clientes                  | Feita                     | **Não aplicada** (aguarda confirmação do Léo)        |
| 4. Agenda, conflitos, estados                    | Feita                     | **Não aplicada**                                     |
| 5. Página pública                                | Feita                     | **Não aplicada**                                     |
| 6. Acessibilidade, testes finais, CI, publicação | Feita, menos a publicação | —                                                    |

O banco real já tem as quatro migrações (conferido em 27/10 com `list_migrations` e consultas ao catálogo; ver `DATABASE.md`). Os tipos do TypeScript agora vêm do gerador do Supabase.

## O que falta

1. **Rodar no banco real os testes pgTAP da agenda e da página pública.** Nas três tentativas a ferramenta do Supabase pediu confirmação ao Léo e desistiu. Ambos passam no PostgreSQL 16 local e no CI. O de cadastros (22/22) e o de isolamento (16/16) já passaram no banco real.
2. **Ajustes no painel do Supabase** (`SECURITY.md`): senha mínima de 8 caracteres, proteção contra senhas vazadas e URLs de redirecionamento.
3. **Decidir a hospedagem** (proposta D-018) e tratar a LGPD antes de clientes reais.
4. **Teste manual de ponta a ponta** no navegador contra o banco real: criar serviço e horário no painel e reservar pela página pública.

## Verificações feitas

- **GitHub Actions verde** no PR (jobs App e Banco). A primeira execução pegou um teste com corrida de tempo, já corrigido.
- `npm run lint`, `format:check`, `typecheck` e `build`: sem erros.
- `npm test`: **188 testes** passando (componentes, telas, regras de negócio, contraste, fuso, dinheiro, estados, cabeçalhos de segurança).
- `npm run test:db`: **85 testes pgTAP** passando no PostgreSQL 16 local, com as 4 migrações (isolamento 16, cadastros 22, agenda 27, página pública 20). Também rodou como usuário comum, igual ao CI.
- Navegador (Chromium/Playwright, scripts temporários fora do repositório):
  - Fluxo real contra o Supabase: login, senha errada, criação do estabelecimento, recarregar, sair.
  - Telas do painel, agenda e página pública com respostas simuladas: axe-core sem violações em computador (1280 px) e celular (390 e 320 px), nos temas claro e escuro, e sem rolagem horizontal.
  - Build servido com os cabeçalhos de `public/_headers`: nenhum bloqueio do CSP, tema e fonte funcionando.
- **Não verificado:**
  - Os testes pgTAP da agenda e da página pública no Supabase real (rodaram só no PostgreSQL 16 local e no CI; o projeto usa 17).
  - O envio real do e-mail de confirmação de cadastro.
  - Leitores de tela de verdade (NVDA, VoiceOver): só o axe e a navegação por teclado.

## Dados de teste no projeto remoto

Usuário `teste-e2e@exemplo.test` com o estabelecimento "Barbearia Exemplo E2E" (fictícios). Podem ser apagados em Authentication > Users.
