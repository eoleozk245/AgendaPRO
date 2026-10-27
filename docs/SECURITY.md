# AgendaPRO — Segurança

## Chaves e variáveis de ambiente

- O frontend usa só a **chave publicável** (`sb_publishable_...`), feita para ficar no navegador. A proteção real vem da RLS.
- As variáveis ficam em `.env.local`, que não vai para o Git (`*.local` está no `.gitignore`). O modelo sem valores é o `.env.example`.
- A chave `secret` / `service_role` **nunca** entra no frontend nem no repositório.

## Controle de acesso

- RLS ligada em todas as tabelas com dados protegidos.
- O visitante sem login (`anon`) não tem nenhum privilégio nas tabelas internas.
- As permissões vêm de `auth.uid()` (o token do usuário), nunca de um ID enviado pelo cliente.
- Gravações sensíveis passam por funções no banco que validam tudo (ex.: `create_organization`).
- O teste `supabase/tests/organizations_isolation.test.sql` prova que um estabelecimento não lê nem altera os dados de outro.

## Avisos conhecidos do Supabase Advisor

| Aviso                                                                             | Motivo                                                                                                                                                | Situação |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `create_organization` é SECURITY DEFINER e pode ser executada por `authenticated` | É de propósito: é a única porta para criar um estabelecimento. Valida login, formato, regra de um estabelecimento por usuário e cria o vínculo junto. | Aceito   |

## Configurações do painel que precisam de ajuste manual

Não dá para mudar estas configurações pelas ferramentas desta sessão. Elas ficam no painel do Supabase, em Authentication:

- **Senha mínima de 8 caracteres** (o padrão do Supabase é 6). A tela já exige 8, mas a garantia precisa estar no servidor.
- **URL Configuration:** colocar `http://localhost:5173` em Site URL / Redirect URLs para o link de confirmação de e-mail voltar ao app em desenvolvimento. Quando houver domínio, adicionar o domínio também.

## Página pública e limite de requisições

- O visitante não tem acesso a nenhuma tabela. A página usa só as três funções públicas (ver `DATABASE.md`).
- Limites: 5 tentativas por IP a cada 10 minutos, 30 por estabelecimento por minuto e 3 agendamentos futuros por telefone. As falhas também contam.
- O IP vem dos cabeçalhos repassados pelo Supabase (`cf-connecting-ip` / `x-forwarded-for`). Se ele não vier, valem os outros limites.
- Os horários livres não revelam quem ocupa os outros.

## LGPD (proposta D-019)

**Já existe no código:**

- Clientes guardam só nome, telefone, e-mail e observações; telefone e e-mail são opcionais no painel (`clients`). A reserva pública coleta só nome e telefone.
- O estabelecimento exclui um cliente pelo painel (Clientes > excluir), com aviso de que os dados pessoais serão apagados.
- Ao apagar o cliente, os agendamentos ficam com `client_id` nulo (`on delete set null`): o histórico continua, sem vínculo pessoal.
- `private.booking_attempts` guarda só IP e horário, e as linhas com mais de 24 horas são apagadas a cada reserva.
- O formulário público avisa: "Usamos seu nome e telefone só para este agendamento e para o estabelecimento falar com você sobre ele."
- A fonte Inter é servida pelo próprio site, sem enviar o IP do visitante ao Google Fonts.

**Falta (antes de clientes reais):**

- Política de privacidade pública e link dela na página `/{slug}`.
- Termo com o estabelecimento definindo controlador e operador.
- Canal de contato para pedidos de titulares e procedimento de incidentes.
- Anonimização automática por inatividade e exportação dos dados de um cliente.
- As **observações do agendamento** (`appointments.notes`) não são limpas quando o cliente é apagado. Se tiverem dado pessoal, continuam no histórico.

## Pendências

- Proteção extra contra robôs na reserva (ex.: CAPTCHA/Turnstile) se aparecer abuso de verdade.
- LGPD antes de uso com clientes reais (ver `DECISIONS.md`).

- **`private.booking_attempts` com RLS ligada e sem policy** (nível informativo no Advisor): é de propósito. Sem policy, ninguém lê pela API; só as funções do banco acessam. O schema `private` não é exposto.
