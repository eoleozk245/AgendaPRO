# AgendaPRO — Instruções do projeto

O nome oficial do produto é **AgendaPRO** (com essa grafia, sempre).

## 1. O que é

Plataforma de agendamento de serviços. Deve ser tratada como um **produto real**, com qualidade profissional, que também serve de **portfólio** e pode ter uso comercial no futuro. Não é demo descartável nem "só uma interface bonita": toda decisão considera usabilidade, segurança, manutenção, desempenho e acessibilidade.

- Cliente final: acessa uma página pública, vê serviços, preços e durações, escolhe profissional, data e horário **realmente livres** e reserva.
- Estabelecimento: gerencia agenda, clientes, serviços, profissionais e horários.
- Administração global da plataforma: **fora do MVP**.

As decisões já tomadas ficam em `docs/DECISIONS.md`. **Leia esse arquivo antes de sugerir qualquer mudança** e não contradiga uma decisão sem explicar o motivo.

## 2. Como trabalhar comigo (o dono do projeto)

- Explique conceitos em português claro, sem transformar a resposta numa aula. Sou estudante de programação e quero entender o que está sendo feito.
- Trabalhe em **etapas pequenas e verificáveis**. Nunca gere a aplicação inteira de uma vez.
- Separe sempre: **Confirmado** (aprovado por mim), **Proposta** (precisa de aprovação), **Pendente** (indefinido) e **Fora do MVP**. Uma sugestão sua não é uma decisão aprovada.
- Não concorde automaticamente. Se algo for inseguro ou ruim, diga, explique o risco e proponha alternativa.
- Antes de decisões que afetam arquitetura, escopo, segurança ou custo: compare as opções, recomende uma e explique o porquê.
- **Nunca diga que rodou testes, migrações, comandos ou deploy sem ter rodado.** Se não puder verificar algo, diga o que ficou sem verificação.
- Não invente arquivos, tabelas, variáveis de ambiente ou APIs sem marcar como proposta nova.
- Faça só as perguntas necessárias. Se uma decisão puder esperar sem risco, registre como pendente.

## 3. Stack

React + TypeScript + Vite no frontend. Supabase (PostgreSQL, Auth, RLS) no backend. Zod para validação. Vitest e React Testing Library para testes. ESLint e Prettier. Git e GitHub.

- Playwright, FullCalendar, Resend e GitHub Actions só entram quando houver necessidade concreta.
- Não instale dependência sem explicar para que serve. Evite complexidade desnecessária.
- Se a decisão depender de versão ou API, confira a documentação oficial atual.

## 4. Identidade visual

SaaS premium, minimalista, com cara de tecnologia e sem excesso de efeitos. Tema claro e escuro (seguindo o sistema, com troca manual e preferência salva).

| Token | Cor |
|---|---|
| Azul elétrico (principal) | `#2563EB` |
| Azul-marinho | `#0B1F3A` |
| Fundo claro | `#F4F7FC` |
| Superfície clara | `#FFFFFF` |
| Fundo escuro | `#111827` |
| Sucesso | `#16A34A` |
| Erro | `#DC2626` |

- Fonte: Inter ou Geist. Ícones: Lucide (nada de emoji como ícone de interface).
- Espaçamentos em múltiplos de 4/8 px, raios de 8 a 14 px, poucos gradientes e animações discretas.
- O modo escuro **não** é o claro com fundo preto: revise contraste, superfícies e bordas separadamente.
- Defina também cores para texto secundário, bordas, campos, foco, hover, desabilitado, aviso e informação.
- Componentes reutilizáveis (botão, campo, menu, modal, cartão, tabela, alerta, indicador de estado).
- Estados de carregamento, vazio, sucesso e erro em toda tela. Foco visível, navegação por teclado, rótulos claros e alvos de toque confortáveis. Estados nunca dependem só de cor.

## 5. Segurança (desde o início)

- Nunca coloque chave privilegiada ou segredo no frontend nem no repositório. Use variáveis de ambiente e mantenha um `.env.example` sem segredos.
- **Esconder botão não é controle de acesso.** Toda operação protegida é validada no banco ou no servidor.
- RLS ligada em toda tabela com dados protegidos. Nunca confie em IDs enviados pelo cliente para decidir permissão.
- Teste automatizado provando que um estabelecimento não enxerga os dados de outro.
- Valide todos os dados na camada confiável, não só no formulário.
- Erros sem detalhes internos. Nada de senha, token ou dado sensível em log.
- Limite de requisições nas operações públicas (reserva) contra abuso.
- Colete só os dados necessários dos clientes finais. Antes de uso com clientes reais, tratar LGPD.
- Use dados fictícios em desenvolvimento e demonstrações, sempre identificados como exemplo.

## 6. Regras de agenda e dados

- **Fuso:** datas em `timestamptz` (UTC). O fuso do estabelecimento fica guardado na organização (inicialmente `America/Sao_Paulo`). Nunca trate horário local como UTC sem converter.
- **Dinheiro:** inteiro em centavos. Nunca ponto flutuante.
- O agendamento guarda uma **cópia do preço e da duração** no momento da reserva.
- **Conflitos resolvidos no banco:** exclusion constraint do PostgreSQL por profissional, ignorando agendamentos cancelados. A interface só mostra horários livres, mas a garantia final é do banco.
- A reserva pública passa por uma **função no banco** que valida tudo, e os horários livres vêm de outra função. O público nunca grava direto nas tabelas.
- **Estados:** `pending → confirmed → completed`. `cancelled` sai de `pending` ou `confirmed`. `no_show` só sai de `confirmed`. Qualquer outra transição é inválida.
- Migrações versionadas em `supabase/migrations/`. Nunca mude estrutura só pelo painel. Nunca afirme que uma migração foi aplicada sem confirmação.

## 7. Código e qualidade

- Código legível e explícito é melhor que abstração desnecessária. Sem `any` no TypeScript.
- Sem arquivos gigantes, componentes que fazem de tudo ou regra de negócio duplicada. Regra de negócio separada da apresentação quando isso ajudar.
- Respeite as convenções do código existente. Mudança localizada é melhor que reescrever módulos.
- Não crie pastas vazias nem camadas sem uso. A estrutura sugerida (`src/app`, `components`, `features`, `lib`, `styles`, `supabase/`) é referência, não obrigação.
- Testes proporcionais ao risco. Prioridade: disponibilidade, conflitos, cálculo de horários, transições de estado, permissões, isolamento entre estabelecimentos, autenticação, falhas de rede.
- Tela só está concluída depois de verificar estados, responsividade, acessibilidade e consistência com o design system.

## 8. Fluxo de trabalho

1. Defina objetivo e critério de conclusão.
2. Liste dependências, riscos e arquivos afetados.
3. Implemente **só** o escopo combinado.
4. Rode (ou indique) os testes relevantes, informando o resultado real.
5. Atualize a documentação e registre decisões.
6. Resuma e proponha o próximo passo.

Commits pequenos, com mensagens claras. Não misture grandes funcionalidades numa mesma mudança. Mantenha sempre uma versão funcional.

Ao entregar código, informe: objetivo, arquivos criados ou alterados, dependências, como rodar e testar, e limitações conhecidas.

## 9. Documentação e continuidade

Mantenha em `docs/` somente o que existe de fato: `PRODUCT.md`, `DESIGN_SYSTEM.md`, `ARCHITECTURE.md`, `DATABASE.md`, `SECURITY.md`, `ROADMAP.md`, `DECISIONS.md` e `STATUS.md`. Crie cada um quando for necessário e nunca diga que um arquivo foi criado ou atualizado se isso não aconteceu.

No começo de cada sessão: leia este arquivo, `docs/DECISIONS.md` e `docs/STATUS.md` (se existir), identifique o que está confirmado, proposto e pendente, e verifique o estado real do código. Funcionalidade no roadmap não é funcionalidade implementada.

Ao fim de uma etapa, resuma: o que foi concluído, arquivos alterados, decisões, pendências e riscos, testes executados com resultado, e a próxima tarefa.

## 10. Roadmap (resumo)

1. Fundação: repositório, tokens de design (claro e escuro), componentes base.
2. Autenticação, organização, RLS e testes de isolamento.
3. Serviços, horários e clientes.
4. Agenda, conflitos e estados.
5. Página pública de agendamento.
6. Acessibilidade, testes finais e publicação.
7. Evolução futura (só depois de validar o MVP).

Não avance de fase sem verificar que a anterior funciona e está documentada.
