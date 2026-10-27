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
3. **Tratar a LGPD** (proposta D-019) antes de clientes reais.

## Verificações feitas

- **GitHub Actions verde** no PR (jobs App e Banco). A primeira execução pegou um teste com corrida de tempo, já corrigido.
- `npm run lint`, `format:check`, `typecheck` e `build`: sem erros.
- `npm test`: **188 testes** passando (componentes, telas, regras de negócio, contraste, fuso, dinheiro, estados, cabeçalhos de segurança).
- `npm run test:e2e`: **13 testes Playwright** passando (3 execuções seguidas sem falha), com o Supabase simulado: login e senha errada, painel sem sessão, página pública (computador e celular escuro), validação, agenda do dia e da semana, detalhes do agendamento, serviços e modal com Esc, páginas não encontradas. Todos passam pelo axe-core e conferem rolagem horizontal. Também roda no CI (job "E2E (Playwright)").
- `npm run test:db`: **85 testes pgTAP** passando no PostgreSQL 16 local, com as 4 migrações (isolamento 16, cadastros 22, agenda 27, página pública 20). Também rodou como usuário comum, igual ao CI.
- Navegador (Chromium/Playwright, scripts temporários fora do repositório):
  - Fluxo real contra o Supabase: login, senha errada, criação do estabelecimento, recarregar, sair.
  - Telas do painel, agenda e página pública com respostas simuladas: axe-core sem violações em computador (1280 px) e celular (390 e 320 px), nos temas claro e escuro, e sem rolagem horizontal.
  - Build servido com os mesmos cabeçalhos de segurança (hoje em `vercel.json`): nenhum bloqueio do CSP, tema e fonte funcionando.
- **Ponta a ponta no Supabase real** (27/10, Chromium, usuário e dados fictícios): login → criar serviço → horário de funcionamento → reserva pela página pública `/barbearia-exemplo-e2e` → agendamento aparece "Pendente" na agenda às 10:00 (fuso certo) → confirmar → o horário e os que se sobrepõem somem da página pública (35 → 32 horários livres) → tentar agendar no mesmo horário pelo painel mostra o conflito vindo do banco. axe-core sem violações na agenda e na página pública (também no celular escuro).
- **Ponta a ponta no Supabase real, parte 2** (27/10): remarcar 10:00 → 11:00 (a página pública libera o antigo e tira o novo), concluir e "não compareceu" em horários já passados (concluído vira só leitura), cancelar com confirmação (o horário volta a ficar livre), bloquear 14:00–15:00 (some da página pública, o banco recusa agendamento às 14:15, e remover devolve os horários). axe-core sem violações na semana, no dia e no celular escuro.
- Ficaram no banco de teste: serviço "Corte Exemplo", horário de quarta 09:00–18:00, "Cliente Exemplo E2E" e três agendamentos (28/10 11:00 cancelado; 27/10 08:00 concluído; 27/10 07:00 não compareceu). Nenhum bloqueio.
- **Não verificado:**
  - Os testes pgTAP da agenda e da página pública no Supabase real (rodaram só no PostgreSQL 16 local e no CI; o projeto usa 17). O fluxo principal deles foi exercitado no teste de ponta a ponta acima.
  - No banco real: trocar o serviço ao remarcar e o caminho pendente → cancelado (cobertos pelos testes locais e do CI).
  - O envio real do e-mail de confirmação de cadastro.
  - Leitores de tela de verdade (NVDA, VoiceOver): só o axe e a navegação por teclado.

## Dados de teste no projeto remoto

Usuário `teste-e2e@exemplo.test` com o estabelecimento "Barbearia Exemplo E2E" (fictícios). Podem ser apagados em Authentication > Users.
