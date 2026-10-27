# AgendaPRO — Design system

## Tokens

Definidos em `src/styles/tokens.css` como variáveis CSS, com um bloco para o tema claro (`:root`) e outro para o escuro (`:root[data-theme='dark']`).

- **Cores:** marca, fundos/superfícies, texto (principal, secundário, desabilitado, link), bordas e campos, ações (primária, perigo), foco e feedback (sucesso, erro, aviso, informação, neutro), cada um com texto, fundo e borda.
- **Espaçamento:** `--space-1` (4px) até `--space-12` (48px).
- **Raios:** 8, 10 e 14 px.
- **Tipografia:** Inter (servida pelo próprio site), tamanhos de `--text-xs` a `--text-2xl`.
- **Alvos de toque:** 44 px (padrão) e 36 px (pequeno, só com mouse). Em tela de toque (`pointer: coarse`), o pequeno também vira 44 px. Botão só de ícone tem largura mínima igual à altura. Ícone que não pode crescer (ex.: remover bloqueio na agenda) ganha área de toque invisível ao redor.

O contraste é conferido automaticamente em `src/styles/tokens.test.ts` (WCAG AA) nos dois temas. Se uma cor mudar, rode `npm test`.

O tema escuro foi revisado à parte: superfícies sobem de tom em vez de usar sombra, o texto não é branco puro e os tons de feedback são mais claros.

## Tema

Sistema, Claro ou Escuro, com a preferência salva no navegador. Um script no `index.html` aplica o tema antes da primeira pintura (liberado no CSP por hash).

## Componentes (`src/components/`)

| Componente                                              | Uso                                                                    |
| ------------------------------------------------------- | ---------------------------------------------------------------------- |
| `Button`                                                | Variantes primary, secondary, ghost, danger; tamanhos md/sm; `loading` |
| `TextField`, `TextAreaField`, `SelectField`, `Checkbox` | Campos com rótulo, dica e erro acessíveis                              |
| `Alert`                                                 | Info, sucesso, aviso, erro (ícone + texto; erros anunciados)           |
| `Badge`                                                 | Indicador de estado com ícone                                          |
| `Card`                                                  | Superfície                                                             |
| `Modal`                                                 | `<dialog>` nativo (foco preso, Esc fecha)                              |
| `ConfirmDialog`                                         | Confirmação de ação destrutiva                                         |
| `EmptyState`, `LoadingState`                            | Estados de vazio e carregamento                                        |
| `PageHeader`                                            | Título da tela + ação principal                                        |
| `AppHeader`, `ThemeToggle`                              | Cabeçalho e seletor de tema                                            |
| `Table.module.css`                                      | Tabela que vira cartões no celular                                     |

## Regras

- Estados nunca dependem só de cor: sempre há ícone, texto, borda ou padrão junto.
- Foco visível em tudo (`:focus-visible`) e link "Pular para o conteúdo".
- Formulário com erro leva o foco ao primeiro campo a corrigir (`focusFirstInvalid` em `src/lib/focus.ts`).
- No celular, o menu do painel é uma faixa que rola para os lados e sempre mostra a página atual.
- Toda tela tem estados de carregamento, vazio, erro (com "tentar de novo") e sucesso.
- Animações respeitam `prefers-reduced-motion`.
