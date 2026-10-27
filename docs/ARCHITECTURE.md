# AgendaPRO — Arquitetura

## Visão geral

- **Frontend:** SPA em React + TypeScript (Vite). Fala direto com o Supabase pelo `supabase-js`, usando só a chave publicável.
- **Backend:** Supabase. As regras importantes ficam no **banco**: RLS, constraints, triggers e funções. A tela só ajuda; quem garante é o PostgreSQL.
- **Página pública:** usa só funções `SECURITY DEFINER` expostas para `anon` (nunca tabelas).

## Pastas

```
src/
  App.tsx                 rotas (react-router)
  main.tsx                ponto de entrada (BrowserRouter + AuthProvider)
  components/             componentes visuais reutilizáveis (sem regra de negócio)
  features/
    auth/                 login, cadastro, sessão
    organization/         criar estabelecimento, configurações, contexto do estabelecimento
    panel/                porta de entrada e layout do painel
    services/             cadastro de serviços
    business-hours/       horário de funcionamento
    clients/              clientes
    agenda/               agenda do dia/semana, agendamentos, bloqueios, estados
    public-booking/       página pública /{slug}
  lib/                    utilitários: supabase, env, dinheiro, telefone, fuso, erros, tema
  styles/                 tokens e estilos globais
  test/                   configuração e helpers de teste
supabase/
  migrations/             estrutura do banco, em ordem
  tests/                  testes pgTAP (+ support/ com a imitação mínima do Supabase)
scripts/test-db.sh        roda migrações + testes num PostgreSQL temporário
```

Cada feature costuma ter: `api.ts` (chamadas ao Supabase, com erros traduzidos), `schemas.ts` (Zod, espelhando as constraints do banco), telas `*.tsx` com CSS Module e testes ao lado.

## Rotas

| Rota                      | Quem acessa     | Tela                                   |
| ------------------------- | --------------- | -------------------------------------- |
| `/entrar`                 | Visitante       | Entrar / criar conta                   |
| `/painel`                 | Dono logado     | Agenda (dia e semana)                  |
| `/painel/servicos`        | Dono logado     | Serviços                               |
| `/painel/equipe`          | Dono logado     | Profissionais e os serviços de cada um |
| `/painel/horarios`        | Dono logado     | Horário de funcionamento               |
| `/painel/clientes`        | Dono logado     | Clientes                               |
| `/painel/estabelecimento` | Dono logado     | Dados, fuso, regras de reserva         |
| `/{slug}`                 | Qualquer pessoa | Página pública de agendamento          |

Sem sessão, o painel manda para `/entrar`. Sem estabelecimento, mostra o cadastro do estabelecimento. Esconder a tela não é a proteção: os dados só saem do banco se a RLS permitir.

## Datas, fuso e dinheiro

- O banco guarda `timestamptz` (UTC). A tela converte de e para o fuso do estabelecimento com `src/lib/timezone.ts` (testado, inclusive com horário de verão).
- Datas locais circulam como texto `AAAA-MM-DD` e horas como `HH:MM`.
- Dinheiro em centavos (inteiro). `src/lib/money.ts` converte o texto digitado sem usar ponto flutuante.

## Estados de carregamento

`useAsyncData` padroniza carregando / erro / pronto, com "tentar de novo". Quando a fonte muda (ex.: outro dia na agenda), volta a "carregando" em vez de mostrar dados antigos.
