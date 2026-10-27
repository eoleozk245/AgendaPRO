# AgendaPRO — Banco de dados

Projeto Supabase: `AgendaPRO` (ref `xlafrbbugxypjuuadszg`, região `sa-east-1`).

## Regras

- Toda mudança de estrutura é uma migração em `supabase/migrations/`, aplicada em ordem. Nunca mude a estrutura só pelo painel.
- Uma migração já aplicada não é editada: a correção vira uma migração nova.
- Depois de cada migração, gere de novo os tipos em `src/lib/database.types.ts`.

## Tabelas

| Tabela          | Para que serve                                 | Quem acessa                          |
| --------------- | ---------------------------------------------- | ------------------------------------ |
| `organizations` | Estabelecimento: nome, slug, fuso              | Membros leem; dono edita nome e fuso |
| `memberships`   | Liga usuário a estabelecimento (papel `owner`) | Membros leem; ninguém grava pela API |

## Funções

| Função                                    | Schema         | Uso                                                        |
| ----------------------------------------- | -------------- | ---------------------------------------------------------- |
| `create_organization(org_name, org_slug)` | `public` (RPC) | Cria estabelecimento + vínculo de dono. Só usuário logado. |
| `is_member(org_id)`, `is_owner(org_id)`   | `private`      | Usadas pelas policies de RLS.                              |
| `is_valid_timezone(tz)`                   | `private`      | Valida o fuso no CHECK.                                    |

## Migrações aplicadas

| Arquivo                                                   | Aplicada no projeto                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20261026060000_organizations_and_memberships.sql`        | **Sim** (versão `20261026051254` no Supabase)                                                                                                                                                                                                                                                                                                                                      |
| `20261026080000_services_professionals_hours_clients.sql` | **Sim** (versão `20261027175242`, 27/10/2026, via Supabase MCP). Teste `catalog` (22/22) passou no banco real.                                                                                                                                                                                                                                                                     |
| `20261026100000_appointments_and_blocks.sql`              | **Sim** (versão `20261027175336`, 27/10/2026, via Supabase MCP). O teste `appointments` ainda não rodou no banco real (a ferramenta pediu confirmação sem resposta); passa no PostgreSQL 16 local e no CI.                                                                                                                                                                         |
| `20261026120000_public_booking.sql`                       | **Sim** (27/10/2026), aplicada pelo Léo no SQL Editor do painel. Conferido por consulta ao catálogo: 2 colunas novas, 3 funções públicas, `private.request_ip` e `private.booking_attempts`, e `anon` sem acesso à tabela de tentativas. **Não aparece em `list_migrations`**, porque o SQL Editor não grava no histórico. O teste `public_booking` ainda não rodou no banco real. |

As versões das três primeiras vêm de `list_migrations` no projeto real e podem ser conferidas em Database > Migrations no painel. O Supabase grava a data em que aplicou, por isso o número difere do nome do arquivo.

O Supabase registra cada migração com o horário em que foi aplicada, então o número de versão no painel pode ser diferente do nome do arquivo. O conteúdo é o mesmo.

## Testes do banco (pgTAP)

Ficam em `supabase/tests/`. Cada arquivo roda dentro de uma transação desfeita no final (`rollback`), então nada fica gravado.

- **Local, sem Docker:** `npm run test:db`. Sobe um PostgreSQL temporário, carrega uma imitação mínima do Supabase (`supabase/tests/support/supabase_stub.sql`: papéis `anon`/`authenticated`, `auth.users`, `auth.uid()` e as permissões padrão), aplica todas as migrações e roda os testes. Precisa de PostgreSQL 15+ e pgTAP instalados.
- **Local com a Supabase CLI** (precisa do Docker): `supabase start` e depois `supabase test db`.
- **Projeto remoto:** o conteúdo do arquivo pode ser executado no SQL Editor do painel. Para ver todos os resultados numa resposta só, as saídas foram juntadas numa tabela temporária (foi assim que rodei nesta sessão).

Resultados da última execução estão em `docs/STATUS.md`.

## Dados de teste

O usuário `teste-e2e@exemplo.test` (fictício) existe no projeto para os testes de ponta a ponta. Pode ser apagado a qualquer momento em Authentication > Users.

## Avisos do Advisor aceitos

- **Chaves estrangeiras compostas sem índice dedicado** (`appointments`, `availability_blocks`, `professional_services`, nível informativo): cada tabela já tem um índice que começa por `professional_id` (a exclusion constraint, `availability_blocks_professional_starts_idx` e a chave primária), e o PostgreSQL usa esse começo para as consultas e para os apagamentos em cascata. Um índice extra só aumentaria o custo de escrita.
- **Índices "sem uso":** esperado enquanto o banco não tem dados reais. Rever depois que houver uso.

## Histórico de migrações do Supabase

A migração `20261026120000_public_booking.sql` foi aplicada pelo SQL Editor, então o histórico do Supabase não a conhece. Se um dia for usada a Supabase CLI (`supabase db push`), ela tentaria aplicar de novo e falharia. Antes, marque como aplicada: `supabase migration repair --status applied 20261026120000`. Os números das outras migrações no Supabase também diferem dos nomes dos arquivos (o Supabase usa o horário em que aplicou), então o `repair` pode ser necessário para elas também.

## Tipos do TypeScript

`src/lib/database.generated.ts` é a saída do gerador de tipos do Supabase (27/10/2026, banco real com as quatro migrações). `src/lib/database.types.ts` a embrulha e descreve só a exceção do agendamento: nome do serviço, duração, preço e fim são preenchidos por trigger, e o app só envia as colunas liberadas pelos grants. Depois de uma nova migração, gere de novo.
