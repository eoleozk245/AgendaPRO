# AgendaPRO — Registro de decisões

Última atualização: 26/10/2026

**Como ler este arquivo:** as decisões abaixo marcadas como *Confirmado* foram aprovadas pelo Léo. As D-002 a D-005 foram **decididas por delegação** (ele pediu para escolher o que fosse melhor, seguindo as instruções do projeto) e podem ser revistas a qualquer momento. Nada aqui está implementado ainda: este arquivo registra decisões, não código pronto.

## Decisões

### D-001 — Nome do produto
**Confirmado.** O nome oficial é **AgendaPRO**, com essa grafia.

### D-002 — Stack
**Confirmado (por delegação).** React + TypeScript + Vite no frontend, Supabase (PostgreSQL, Auth, RLS) no backend, Zod para validação, Vitest + React Testing Library para testes.
- *Por quê:* agenda tem muito estado (calendário, formulários, permissões) e fica difícil de manter em JavaScript puro. Migrar depois custaria caro.
- *Custo:* curva de aprendizado maior no começo, compensada por trabalhar em etapas pequenas.

### D-003 — Multi-tenant
**Confirmado (por delegação).** O banco nasce preparado para vários estabelecimentos (`organization_id` + RLS), mas o MVP roda com **um** estabelecimento.
- *Por quê:* custa pouco agora e é caro de adicionar depois.
- *Risco:* RLS mal feita é o maior risco do projeto. Por isso entra cedo, com teste de isolamento entre estabelecimentos.

### D-004 — Público-alvo do MVP
**Confirmado (por delegação).** Barbearias e salões. Serviço + duração + profissional encaixa bem nesse tipo de negócio.

### D-005 — Objetivo
**Confirmado (por delegação).** Portfólio com qualidade de uso real. Antes de ter qualquer cliente real, tratar LGPD (dados pessoais, retenção, exclusão).

### D-006 — Identidade visual
**Confirmado** (definida nas instruções do projeto). SaaS premium, minimalista, tema claro e escuro, azul elétrico `#2563EB` e azul-marinho `#0B1F3A`. A paleta completa está no `CLAUDE.md` e pode ser ajustada após testes de contraste.

### D-007 — Datas e dinheiro
**Proposta aceita junto com o resto do plano.**
- Datas em `timestamptz` (UTC); o fuso do estabelecimento fica na organização (inicialmente `America/Sao_Paulo`).
- Valores em centavos (inteiro).
- O agendamento guarda cópia do preço e da duração do momento da reserva.

### D-008 — Prevenção de conflitos
**Proposta aceita junto com o resto do plano.** Exclusion constraint do PostgreSQL por profissional, ignorando agendamentos cancelados (requer a extensão `btree_gist`). Se dois clientes reservarem ao mesmo tempo, o banco recusa o segundo. A reserva pública passa por uma função no banco; os horários livres vêm de outra função; o público nunca grava direto nas tabelas.

### D-009 — Estados do agendamento
**Proposta aceita junto com o resto do plano.**
- `pending → confirmed → completed`
- `cancelled` sai de `pending` ou `confirmed`
- `no_show` só sai de `confirmed`
- Qualquer outra transição é inválida.

### D-010 — Repositório
**Confirmado.** GitHub, conta `eoleozk245`, repositório **privado** `AgendaPRO`, branch `main`.

## Escopo do MVP

**Dentro:**
- Login do dono e cadastro do estabelecimento
- Serviços (preço e duração) e horário de funcionamento
- Agenda por dia e semana: criar, reagendar e cancelar
- Clientes básicos
- Página pública `/{slug}` que mostra só horários realmente livres

**Tabelas do MVP:** organizations, memberships, services, professionals, professional_services, clients, business_hours, availability_blocks, appointments. O banco já terá profissionais, mas a tela de equipe fica fora do MVP (começa com 1 profissional).

## Pendente

- Calendário: FullCalendar ou grade própria (decidir na Etapa 4).
- Hospedagem: Vercel ou Cloudflare Pages (decidir na Etapa 6).
- Política de cancelamento e reagendamento (antecedência mínima).
- Política de retenção e exclusão de dados (LGPD).
- Formato do `slug` público e como evitar colisões.
- Playwright (testes de ponta a ponta): decidir quando o fluxo central estiver pronto.

## Fora do MVP

Administração global da plataforma, e-mails e lembretes, pagamentos e sinal, lista de espera, agendamentos recorrentes, planos e assinaturas, tabelas `notifications` e `audit_logs` (entram junto com e-mails e auditoria).

## Roadmap

1. Fundação: repositório, tokens de design (claro e escuro), componentes base
2. Autenticação, organização, RLS e testes de isolamento
3. Serviços, horários e clientes
4. Agenda, conflitos e estados
5. Página pública de agendamento
6. Acessibilidade, testes finais e deploy
