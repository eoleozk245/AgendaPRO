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

Enquanto as migrações 2 a 4 não forem aplicadas, só o login e o cadastro do estabelecimento funcionam contra o Supabase real. As telas das Etapas 3 a 5 mostram o estado de erro.

## O que falta para o MVP rodar de ponta a ponta

1. **Aplicar as migrações pendentes**, em ordem (ver abaixo).
2. **Gerar de novo os tipos** (`src/lib/database.types.ts`) a partir do banco. Hoje as partes das Etapas 3 a 5 foram escritas à mão no mesmo formato.
3. **Ajustes no painel do Supabase** (`SECURITY.md`): senha mínima de 8 caracteres e URLs de redirecionamento.
4. **Decidir a hospedagem** (proposta D-018) e tratar a LGPD antes de clientes reais.

### Como aplicar as migrações

As três migrações pendentes estão em `supabase/migrations/` e precisam entrar nesta ordem:

1. `20261026080000_services_professionals_hours_clients.sql`
2. `20261026100000_appointments_and_blocks.sql`
3. `20261026120000_public_booking.sql`

Opções:

- Pedir ao Claude para aplicar (a ferramenta do Supabase vai pedir sua confirmação), ou
- Colar cada arquivo, em ordem, no **SQL Editor** do painel do Supabase.

Depois, rodar os testes pgTAP no projeto (ver `DATABASE.md`) e conferir o Advisor.

## Verificações feitas

- `npm run lint`, `format:check`, `typecheck` e `build`: sem erros.
- `npm test`: **188 testes** passando (componentes, telas, regras de negócio, contraste, fuso, dinheiro, estados, cabeçalhos de segurança).
- `npm run test:db`: **85 testes pgTAP** passando no PostgreSQL 16 local, com as 4 migrações (isolamento 16, cadastros 22, agenda 27, página pública 20). Também rodou como usuário comum, igual ao CI.
- Navegador (Chromium/Playwright, scripts temporários fora do repositório):
  - Fluxo real contra o Supabase: login, senha errada, criação do estabelecimento, recarregar, sair.
  - Telas do painel, agenda e página pública com respostas simuladas: axe-core sem violações em computador (1280 px) e celular (390 e 320 px), nos temas claro e escuro, e sem rolagem horizontal.
  - Build servido com os cabeçalhos de `public/_headers`: nenhum bloqueio do CSP, tema e fonte funcionando.
- **Não verificado:**
  - As migrações 2 a 4 no Supabase real (só no PostgreSQL 16 local; o projeto usa 17).
  - O workflow do GitHub Actions, que só roda no GitHub (a mesma sequência rodou localmente).
  - O envio real do e-mail de confirmação de cadastro.
  - Leitores de tela de verdade (NVDA, VoiceOver): só o axe e a navegação por teclado.

## Dados de teste no projeto remoto

Usuário `teste-e2e@exemplo.test` com o estabelecimento "Barbearia Exemplo E2E" (fictícios). Podem ser apagados em Authentication > Users.
