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

O banco real já tem as tabelas das Etapas 2 a 4 (conferido com `list_migrations` e consulta ao catálogo em 27/10; ver `DATABASE.md`). Falta só a migração da página pública: sem ela, a página `/{endereço}` mostra o estado de erro, e as regras de reserva (antecedência e dias à frente) em "Estabelecimento" não salvam.

## O que falta para o MVP rodar de ponta a ponta

1. **Aplicar a migração pendente** (ver abaixo).
2. **Gerar de novo os tipos** (`src/lib/database.types.ts`) a partir do banco. Hoje as partes das Etapas 3 a 5 foram escritas à mão no mesmo formato.
3. **Ajustes no painel do Supabase** (`SECURITY.md`): senha mínima de 8 caracteres e URLs de redirecionamento.
4. **Decidir a hospedagem** (proposta D-018) e tratar a LGPD antes de clientes reais.

### Como aplicar as migrações

A migração pendente está em `supabase/migrations/20261026120000_public_booking.sql`.

Opções:

- Pedir ao Claude para aplicar e responder quando o Supabase pedir confirmação (nas duas últimas tentativas a pergunta ficou sem resposta e a ferramenta desistiu depois de 60 segundos), ou
- Colar cada arquivo, em ordem, no **SQL Editor** do painel do Supabase.

Depois, rodar os testes pgTAP no projeto (ver `DATABASE.md`) e conferir o Advisor.

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
  - As migrações 2 a 4 no Supabase real (só no PostgreSQL 16 local; o projeto usa 17).
  - O envio real do e-mail de confirmação de cadastro.
  - Leitores de tela de verdade (NVDA, VoiceOver): só o axe e a navegação por teclado.

## Dados de teste no projeto remoto

Usuário `teste-e2e@exemplo.test` com o estabelecimento "Barbearia Exemplo E2E" (fictícios). Podem ser apagados em Authentication > Users.
