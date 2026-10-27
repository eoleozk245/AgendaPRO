# AgendaPRO — Registro de decisões

Última atualização: 27/10/2026

**Como ler este arquivo:** as decisões marcadas como _Confirmado_ foram aprovadas pelo Léo. As marcadas **por delegação** foram tomadas pelo Claude porque o Léo pediu para escolher o que fosse melhor (D-002 a D-005) ou para tocar todas as fases em modo automático (D-011 em diante). Todas podem ser revistas. _Proposta_ ainda precisa de aprovação. O que já está implementado aparece em `STATUS.md`.

## Decisões

### D-001 — Nome do produto

**Confirmado.** O nome oficial é **AgendaPRO**, com essa grafia.

### D-002 — Stack

**Confirmado (por delegação).** React + TypeScript + Vite no frontend, Supabase (PostgreSQL, Auth, RLS) no backend, Zod para validação, Vitest + React Testing Library para testes.

- _Por quê:_ agenda tem muito estado (calendário, formulários, permissões) e fica difícil de manter em JavaScript puro. Migrar depois custaria caro.
- _Custo:_ curva de aprendizado maior no começo, compensada por trabalhar em etapas pequenas.

### D-003 — Multi-tenant

**Confirmado (por delegação).** O banco nasce preparado para vários estabelecimentos (`organization_id` + RLS), mas o MVP roda com **um** estabelecimento.

- _Por quê:_ custa pouco agora e é caro de adicionar depois.
- _Risco:_ RLS mal feita é o maior risco do projeto. Por isso entra cedo, com teste de isolamento entre estabelecimentos.

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

### D-011 — Ferramentas da fundação

**Confirmado (por delegação).** Projeto criado com o modelo `react-ts` do `create-vite` 9.3.1 (React 19, Vite 8, TypeScript 6 em modo `strict`), Node 22 ou superior.

- O modelo atual do Vite vem com **oxlint** no lugar do ESLint. Troquei por **ESLint** porque é o que a stack confirmada (D-002) pede e tem mais documentação e plugins para React.
- Prettier cuida da formatação, e o `eslint-config-prettier` desliga as regras de estilo do ESLint para os dois não brigarem.
- Vitest roda os testes com `jsdom` (um navegador simulado) e Testing Library.
- A regra `no-explicit-any` fica como erro, seguindo o `CLAUDE.md`.

### D-012 — Tokens de design e tema

**Confirmado (por delegação).**

- Tokens em variáveis CSS (`src/styles/tokens.css`), com CSS Modules nos componentes. Nada de biblioteca de UI ou de CSS extra.
- O tema é marcado com `data-theme` no `<html>`. A preferência (Sistema, Claro ou Escuro) fica salva no `localStorage`, e um script pequeno no `index.html` aplica o tema antes da primeira pintura para a tela não piscar.
- O contraste das cores é conferido por teste automático (WCAG AA: 4,5:1 para texto e 3:1 para bordas, foco e limites de componentes) nos dois temas.
- O verde `#16A34A` da paleta tem só 3,3:1 sobre branco. Por isso ele fica em ícones e bordas, e o **texto** de sucesso usa `#15803D`.
- Fonte Inter servida pelo próprio site (`@fontsource-variable/inter`), sem chamada ao Google Fonts: é mais rápido e não envia dados do visitante a terceiros. Ícones `lucide-react`.
- _Atenção futura:_ quando houver uma Content Security Policy, o script inline do tema vai precisar de um hash liberado.

### D-013 — Estabelecimento, vínculos e endereço público

**Confirmado (por delegação).**

- Projeto Supabase `AgendaPRO` na região São Paulo (`sa-east-1`), plano gratuito (escolha do Léo: opção A).
- **Slug** (endereço público `/{slug}`): letras minúsculas sem acento, números e hífens simples, de 3 a 40 caracteres e único. A tela sugere o slug a partir do nome. Ele **não pode ser alterado pela API** depois de criado, para não quebrar links já divulgados.
- No MVP cada usuário participa de **um** estabelecimento, e o único papel é `owner`. Novos papéis entram junto com a tela de equipe.
- O estabelecimento é criado pela função `create_organization`, que cria o estabelecimento e o vínculo de dono na mesma transação. Ninguém insere direto nas tabelas.
- As funções de permissão ficam no schema `private` (não exposto pela API) e sempre usam `auth.uid()`, nunca um ID enviado pelo cliente.
- Login com e-mail e senha (mínimo de 8 caracteres) e confirmação por e-mail.

### D-014 — Painel, rotas e cadastros da Etapa 3

**Confirmado (por delegação).**

- **react-router** (v8) para as rotas: `/entrar`, `/painel/...` e, na Etapa 5, a página pública `/{slug}`. Um app com página pública por endereço precisa de rotas de verdade, e escrever um roteador próprio não compensa.
- Slugs reservados no banco (`painel`, `entrar`, `api`...) para não colidirem com as rotas do app.
- MVP com um profissional: ele nasce junto com o estabelecimento (com o nome do estabelecimento, editável em "Estabelecimento") e é ligado automaticamente a todos os serviços por trigger.
- Horário de funcionamento por estabelecimento (não por profissional), com vários intervalos por dia e sem sobreposição (exclusion constraint).
- Cliente: nome obrigatório, telefone (só dígitos, com DDD) e e-mail opcionais, observações opcionais com aviso para não guardar dados sensíveis. Telefone único por estabelecimento.
- A busca de clientes filtra no navegador. Com muitos clientes vai precisar de busca e paginação no servidor (registrado como pendente).
- No celular, as tabelas viram cartões em vez de rolar para os lados.

### D-015 — Agenda

**Confirmado (por delegação).** Resolve a pendência "FullCalendar ou grade própria".

- **Grade própria**, sem FullCalendar. O MVP precisa só de dia e semana, com um profissional. A grade própria pesa bem menos, segue o design system nos dois temas e foi feita acessível desde o começo (cada agendamento é um botão com texto completo). O FullCalendar volta a ser opção se surgir arrastar e soltar ou várias colunas de profissionais.
- Visão do **dia**: linha do tempo com o expediente listrado por fora, a linha de "agora" e os bloqueios. Os cancelados aparecem numa lista abaixo. Visão da **semana**: lista por dia, que funciona igual no computador e no celular.
- O dono **pode** agendar fora do expediente (encaixe): a tela avisa, mas não bloqueia. A página pública nunca oferece esses horários.
- Agendamento **não é apagado**, só cancelado (fica no histórico). Apagar o cliente deixa o agendamento sem vínculo pessoal (LGPD).
- "Concluído" e "Não compareceu" só aparecem depois do horário de início.
- O fuso é convertido no navegador por um utilitário com testes (inclusive horário de verão). As datas viajam em UTC.

### D-016 — Página pública de agendamento

**Confirmado (por delegação).** Resolve em parte a pendência "política de cancelamento e reagendamento".

- Endereço `/{slug}`, sem login. O visitante só chama três funções no banco: `get_public_booking_page`, `get_available_slots` e `book_appointment`. Nunca grava direto em tabelas.
- Horários de **15 em 15 minutos** dentro do expediente, cabendo o serviço inteiro antes do fechamento, sem agendamentos ativos nem bloqueios no caminho.
- **Antecedência mínima** configurável (padrão: 2 horas) e **limite de dias à frente** (padrão: 60), em "Estabelecimento".
- A reserva nasce **pendente** e o estabelecimento confirma no painel. A função confere de novo se o horário está entre os livres, e se duas pessoas reservarem ao mesmo tempo, o banco recusa a segunda.
- **Limite de tentativas:** 5 por IP a cada 10 minutos, 30 por estabelecimento por minuto e no máximo 3 agendamentos futuros por telefone. As tentativas que falham também contam (a função devolve `{ok:false}` em vez de lançar erro, para o registro não ser desfeito). O registro guarda só IP e horário, por 24 horas.
- O cliente é identificado pelo **telefone**. Se já existe, o cadastro é reaproveitado sem sobrescrever o nome que o estabelecimento guardou.
- Aviso de uso dos dados no formulário (nome e telefone só para o agendamento).
- **Fora do MVP:** o cliente cancelar ou remarcar sozinho pela página (por enquanto, fala com o estabelecimento).

### D-017 — CI e segurança de publicação

**Confirmado (por delegação).**

- **GitHub Actions** em todo PR e na `main`, com dois jobs: app (lint, formatação, tipos, testes e build) e banco (PostgreSQL 16 + pgTAP via `scripts/test-db.sh`). Necessidade concreta: o projeto já tem migrações e regras críticas que precisam ser verificadas sempre.
- **Content Security Policy** e outros cabeçalhos em `vercel.json` (ver D-018). O script de tema é liberado por hash, e um teste confere se o hash bate com o `index.html`.
- **Playwright** entrou (27/10) como suíte de navegador em `e2e/` (`npm run test:e2e`), com as respostas do Supabase **simuladas** por `page.route`: roda no CI sem segredos e nunca toca no banco real. Cada teste também passa pelo axe-core e confere que não há rolagem horizontal. Dependências: `@playwright/test` (mesma versão do Playwright do ambiente, 1.63.0, travada com `overrides` de `playwright-core`) e `@axe-core/playwright` (axe dentro dos testes). O teste de ponta a ponta contra o banco real continua manual.

### D-018 — Hospedagem

**Confirmado (decisão do Léo, 27/10/2026): Vercel.** Substitui a proposta anterior (Cloudflare Pages).

- Projeto Vercel ligado ao repositório do GitHub: cada push na `main` publica em produção, e cada PR ganha uma prévia.
- Configuração em `vercel.json`: build do Vite, todas as rotas caem no `index.html` (SPA com `/{slug}`) e os cabeçalhos de segurança (CSP, nosniff, frame-ancestors etc.). Arquivos em `/assets` ficam em cache por 1 ano (o nome muda a cada build).
- Variáveis na Vercel: só `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (públicas por natureza). Nenhuma chave secreta.
- **Atenção:** o plano gratuito (Hobby) é só para uso não comercial. Para vender o AgendaPRO, migrar para o plano Pro.
- Antes de clientes reais continua valendo a LGPD (D-005, D-019).

### D-019 — Retenção e exclusão de dados (LGPD)

**Proposta (precisa da aprovação do Léo).** Sugestão técnica, **não é aconselhamento jurídico**: revisar com alguém da área antes de clientes reais.

- **Papéis:** o estabelecimento é o **controlador** dos dados dos seus clientes; o AgendaPRO é o **operador** (guarda e processa a pedido dele). Do dono da conta, o AgendaPRO é controlador.
- **Base legal sugerida:** execução de contrato ou procedimentos preliminares (o cliente pede o agendamento).
- **Dados e finalidade:** nome e telefone (reserva pública e contato sobre o agendamento); e-mail e observações opcionais, só pelo painel; IP das tentativas de reserva, só contra abuso.
- **Retenção sugerida:**
  - Tentativas de reserva: 24 horas (já implementado).
  - Cliente sem agendamento há **24 meses**: anonimizar (sugestão; prazo a definir).
  - Histórico de agendamentos: mantido sem dado pessoal (já acontece ao apagar o cliente).
  - Conta do estabelecimento encerrada: apagar tudo em até 30 dias (sugestão).
- **Direitos do titular hoje:** acesso e correção pelo estabelecimento no painel (Clientes > editar); exclusão em Clientes > excluir. Não existe autoatendimento para o cliente final.
- **Antes de clientes reais:** política de privacidade pública com link na página `/{slug}`; termo de uso com o estabelecimento (papéis de controlador e operador); canal de contato para pedidos de titulares; registro e procedimento de incidentes.
- **Implementação futura sugerida:** job periódico de anonimização, exportação dos dados de um cliente (portabilidade e acesso) e limpeza das observações de agendamentos de clientes apagados.

### D-020 — Equipe (vários profissionais)

**Escopo confirmado pelo Léo (27/10/2026: "Equipe" é o primeiro item da Etapa 7). Detalhes por delegação.** Atualiza D-014, que começava com um profissional só.

- **Página Equipe** (`/painel/equipe`): cadastrar, editar, desativar e excluir profissionais, e escolher quais serviços cada um faz. O nome do profissional saiu da tela "Estabelecimento".
- **Regra no banco** (trigger do agendamento):
  - Ao criar, **remarcar** ou trocar o profissional ou o serviço, o profissional precisa ser do mesmo estabelecimento e estar **ativo**.
  - Ao criar ou trocar o profissional ou o serviço, ele também precisa **fazer o serviço**.
  - Mudar só a situação continua permitido: confirmar, cancelar ou marcar como concluído o que estava marcado com alguém desativado. Para remarcar, primeiro passe o horário para um profissional ativo.
  - A linha do profissional fica travada até o fim da gravação. Uma desativação ou troca de serviços feita ao mesmo tempo espera, em vez de deixar passar uma reserva no meio.
  - A página pública já seguia essa regra; agora o painel também.
- **Só o dono grava agendamento pelo painel**, conferido no trigger antes das outras regras, para as mensagens de erro não revelarem nada de outro estabelecimento. A reserva pública e rotinas internas sem usuário passam.
- **Serviços de um profissional** são trocados pela função `set_professional_services`, com a lista inteira numa transação só.
  - Ela roda com as permissões de quem chama (a RLS vale).
  - Ignora IDs de serviços de outro estabelecimento, IDs repetidos e nulos. Recusa uma lista nula.
  - Trava o profissional: duas gravações ao mesmo tempo terminam com a última lista.
- **Desativar em vez de excluir:** profissional com agendamentos não pode ser excluído (o banco recusa); a tela orienta a desativar. Inativo some da página pública e dos novos agendamentos, mas continua na agenda para consulta.
- **A agenda mostra um profissional por vez**, escolhido num seletor que só aparece quando há mais de um. Mantém a grade própria (D-015) simples. Várias colunas lado a lado ficam para quando houver necessidade.
- **Novo profissional começa fazendo todos os serviços** (o banco já ligava; o formulário vem com eles marcados). **Serviço novo continua indo para toda a equipe**, inclusive inativos (regra do MVP, mantida). O formulário de serviço avisa para ajustar em Equipe. Mudar para "ninguém faz" esconderia o serviço novo da página pública sem o dono entender por quê.
- **Proposta (precisa do Léo):** escolher os profissionais no próprio formulário do serviço quando houver mais de um.
- **Fora desta etapa:** login próprio para cada profissional (papel de funcionário), horário de trabalho por profissional (hoje o horário é do estabelecimento) e comissões.

### D-021 — Visual com vidro (glassmorphism)

**Confirmado pelo Léo (27/10/2026): "vidro em quase tudo".** Muda a identidade visual do CLAUDE.md, que antes dizia "minimalista, sem excesso de efeitos".

- **Onde tem vidro** (translúcido com desfoque): cabeçalho, menu do painel, cartões, tabelas, agenda (dia e semana), modais (com o fundo desfocado), estado vazio, troca de tema, cabeçalho e cartões da página pública. Botões secundários e as linhas de tabela no celular ficam translúcidos **sem** desfoque, porque são muitos e pesariam no celular.
- **Onde continua sólido:** campos de formulário, alertas, selos de situação e os próprios agendamentos dentro da agenda, para leitura rápida.
- **Fundo:** manchas suaves da marca (azul, celeste e índigo) atrás do vidro, fixas na tela.
- **Contraste garantido por teste** (`src/styles/tokens.test.ts`), no pior ponto do fundo e nos dois temas. Para passar, o verde de texto de sucesso e a borda dos campos do tema claro ficaram um tom mais escuros. No escuro, o vidro usa a cor do fundo, porque com a cor da superfície o botão azul perdia contraste.
- **Sem desfoque ou com "reduzir transparência":** as superfícies voltam a ser sólidas.
- **Custo conhecido:** o desfoque usa mais a placa de vídeo. Por isso há poucas camadas de vidro por tela e nenhuma em listas longas.

## Escopo do MVP

**Dentro:**

- Login do dono e cadastro do estabelecimento
- Serviços (preço e duração) e horário de funcionamento
- Agenda por dia e semana: criar, reagendar e cancelar
- Clientes básicos
- Página pública `/{slug}` que mostra só horários realmente livres

**Tabelas do MVP:** organizations, memberships, services, professionals, professional_services, clients, business_hours, availability_blocks, appointments. O banco já terá profissionais, mas a tela de equipe fica fora do MVP (começa com 1 profissional).

## Pendente

- Cancelamento e remarcação pelo próprio cliente (hoje só pelo estabelecimento).
- Escolher os profissionais no formulário do serviço (proposta em D-020).
- Política de retenção e exclusão de dados (LGPD): proposta em D-019, aguardando aprovação.
- Componente de menu suspenso: criar quando uma tela precisar.
- Busca e paginação de clientes no servidor quando a lista crescer.

## Fora do MVP

Administração global da plataforma, cancelamento pelo cliente na página pública, e-mails e lembretes, pagamentos e sinal, lista de espera, agendamentos recorrentes, planos e assinaturas, tabelas `notifications` e `audit_logs` (entram junto com e-mails e auditoria).

## Roadmap

1. Fundação: repositório, tokens de design (claro e escuro), componentes base
2. Autenticação, organização, RLS e testes de isolamento
3. Serviços, horários e clientes
4. Agenda, conflitos e estados
5. Página pública de agendamento
6. Acessibilidade, testes finais e deploy
7. Evolução, uma por vez e em PRs separados (ordem escolhida pelo Léo em 27/10/2026): equipe (D-020), cancelamento e remarcação pelo cliente, e-mails e lembretes
