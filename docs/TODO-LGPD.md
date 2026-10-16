# Controle de Progresso — LGPD & Refatoração de Segurança

## 1. Objetivo
Remover a consulta pública de pedidos e agendamentos por WhatsApp (incompatível com a LGPD) e substituí-la por autenticação segura via Google OAuth, garantindo que cada cliente acesse exclusivamente seus próprios registros na área "Minha Conta". O fluxo de compra (checkout) e agendamento continua permitindo compras sem login prévio (convidado).

## 2. Decisões de Arquitetura
- **Isolamento de Contexto**: `ctx.user` (cliente final, cookie `COOKIE_NAME`, sessão JWT de 30 dias) estritamente separado de `ctx.admin` (tabela `admin_users`, cookie `ADMIN_COOKIE`, sessão de 12 horas).
- **Google OAuth Seguro**: Fluxo Authorization Code com PKCE, parâmetros `state` e `nonce` validados por cookies temporários com flag `no-store`.
- **Propriedade de Dados**: Colunas `userId` em `orders` e `bookings` (nulas para convidados). Endpoints `account.orders` e `account.bookings` protegidos com filtro obrigatório por `ctx.user.id`.
- **Proteção de Força Bruta**: Rate limiting deslizante em memória com capacidade limitada (10.000 chaves) no login administrativo e nas rotas públicas críticas (`checkout.createOrder`, `booking.create`, `checkout.validateCoupon`).
- **Resolução de IP Segura**: Confiança no `req.ip` resolvido pelo Express (`trust proxy = 1`) com normalização de IPv4 mapeado (`::ffff:`).

## 3. Ambiente Local
- **Pilha**: XAMPP (MariaDB e phpMyAdmin) no Windows.
- **Bancos de Dados**: `amopets_dev` (desenvolvimento) e `amopets_test` (testes automatizados, com guarda estrita exigindo sufixo `_test`).
- **Comandos Principais**: `pnpm dev` (servidor de desenvolvimento), `pnpm check` (verificação de tipagem `tsc`), `pnpm test` (testes Vitest).
- **Migrações de Banco**: Aplicadas manualmente via phpMyAdmin (arquivos SQL disponíveis em `drizzle-phpmyadmin/`).
- **Variáveis de Ambiente (apenas nomes)**: `DATABASE_URL`, `TEST_DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL`, `NODE_ENV`, `PORT`, `CORS_ORIGIN`, `COOKIE_NAME`.

## 4. Regras de Trabalho com o Agente
1. Sem commit antes da aprovação explícita do usuário.
2. Nenhuma escrita no banco `amopets_dev` durante a execução de testes (usar mocks ou banco `_test`).
3. TDD (Test-Driven Development): escrever testes primeiro e exibir a falha real antes da implementação.
4. Não alterar banco, servidor ou painel administrativo sem autorização prévia do passo.
5. Preservar integridade de documentações, comentários e contratos de API pré-existentes.
6. Não instalar dependências externas sem aprovação prévia.
7. Apresentar plano conciso de até 5 linhas antes de iniciar alterações.
8. Exibir a saída real dos testes (`pnpm test`) e verificação de tipos (`pnpm check`).
9. Apresentar diffs claros dos arquivos modificados e lista completa de alterações.
10. Jamais registrar ou expor segredos, tokens, credenciais, PII ou dados sensíveis em logs/código.
11. Garantir acessibilidade (semântica, ARIA) e respeito a `prefers-reduced-motion` no frontend.
12. Não assumir requisitos ambíguos: solicitar esclarecimentos ou sugerir alternativas estruturadas.
13. Ao final de cada passo, atualizar obrigatoriamente este arquivo `docs/TODO-LGPD.md`.

## 5. Tabela de Passos

| Passo | Descrição | Status | Commit | Observação |
|---|---|---|---|---|
| A | Remoção da consulta pública por WhatsApp | Concluído | `2b3a511` | Rotas públicas de busca por telefone encerradas |
| B | Coluna `userId`, FK e índices em `orders`/`bookings` | Concluído | `097d487` | Migração SQL 0011 em drizzle-phpmyadmin/ |
| C1 | Separação de contexto administrativo e cliente | Concluído | `f84c509` | `ctx.admin` e `ctx.user` desacoplados |
| C2 | Rate limit de login administrativo | Concluído | `f84c509` | Janela deslizante de 15 min, 5 tentativas por IP/usuário |
| C2.1 | Refinamento do rate limit admin | Concluído | `f84c509` | Normalização de username e validação antes do scrypt |
| D1 | Sessão de cliente JWT de 30 dias | Concluído | `e22ab59` | Assinatura HMAC-SHA256 sem dependência externa |
| D1.1 | Ajuste e endurecimento de cookies | Concluído | `e22ab59` | SameSite Lax, Secure em prod, HttpOnly ativo |
| D2 | Autenticação Google OAuth com PKCE | Concluído | `eafde3c` | State, nonce, code_challenge e bloqueio de escalada de perfil |
| D3 | Limpeza OAuth Manus e hardening Google | Concluído | `cc276e6` | Remoção de endpoints Manus e cabeçalho no-store |
| E | Endpoints protegidos `account.orders` e `account.bookings` | Concluído | `54efd47` | Filtro obrigatório por `userId` da sessão |
| F | Página "Minha Conta" no frontend | Concluído | `54efd47` | Listagem tabulada de pedidos e agendamentos |
| G | Associação de dono no checkout e agendamento | Concluído | `54efd47` | Grava `userId` quando cliente logado; null para visitante |
| G.2 | Tela final de agendamento contextual | Concluído | `a95b957` | Link para Minha Conta se autenticado ou convite para login |
| P | Barra de progresso compacta em Minha Conta | Concluído | `b84b43e` | Componente `ProgressTracker` acessível |
| H1 | Endurecimento da sessão e segredos | Concluído | `e90679d` | `assertSessionSecret`, claim `exp` obrigatória, trava em `setDb` |
| H2a | Diagnóstico da superfície HTTP | Concluído | - | Diagnóstico somente-leitura |
| H2b | Limites de payload, CORS, cabeçalhos e rate limit | Concluído | `e90679d` | Limite 1MB, remoção do proxy, HSTS e rate limiting em tRPC |
| H2c | Correção da resolução de IP no rate limit | Concluído | `e90679d` | Uso estrito de `req.ip` via trust proxy e remoção de `::ffff:` |
| T | Criação e manutenção do arquivo de progresso | Concluído | `e90ca4b` | Criação de docs/TODO-LGPD.md |
| H3 | Integridade: número do pedido, fuso horário e exibição | Concluído | `e90ca4b` | Lock FOR UPDATE na sequência, pool UTC (+00:00), fuso America/Sao_Paulo nas datas e fallback 'Cliente' no Google Auth |
| H4 | Limpeza de serviços legados Manus | Pendente | - | Avaliação de remoção de `storage.ts`, `imageGeneration.ts`, etc. |
| 8B | Exclusão de conta pelo titular (LGPD) | Pendente | - | Direito ao esquecimento (opcional) |
| I | Testes integrados finais e validação pré-deploy | Pendente | - | Homologação final dos fluxos |

## 6. Pendências e Notas Técnicas Conhecidas
- **Fuso horário no banco**: Resolvido no Passo H3 (pool mysql2 configurado com `timezone: "Z"` e `SET time_zone = '+00:00'`).
- **Sequência de pedidos**: Resolvido no Passo H3 (`FOR UPDATE`, `Math.max(nextNumber, MAX + 1)` e auto-criação da sequência).
- **Formatação de nome e fuso**: Resolvido no Passo H3 (`formatOrderDate` com `America/Sao_Paulo`, `formatBookingDate` estrito e fallback "Cliente" no Google Auth e em `getFirstName`).
- **Scripts externos**: Analytics do Umami e `debug-collector` herdados a remover ou documentar.
- **Contrato de `auth.me`**: Retorna o registro completo de `User`; sanitizar para retornar somente `id`, `name` e `email`.
- **Estilo CSS**: Classe `status-saiu-p/entrega` contém barra no seletor, exigindo escape ou normalização.
- **Módulos Manus sem uso**: Avaliar depreciação de `storage.ts`, `imageGeneration.ts`, `notification.ts`, `llm.ts`, `heartbeat.ts` e `map.ts`.
- **Limpeza de dependências**: Identificar pacotes npm órfãos após remoção de integrações legadas.
- **Política de Privacidade**: Atualizar texto no frontend para refletir a nova coleta, autenticação Google e direitos LGPD.

## 7. Checklist de Deploy (Hostinger)
- [ ] Executar backup completo do banco de produção antes de qualquer alteração.
- [ ] Executar o script SQL da migração `0011` manualmente no phpMyAdmin da Hostinger ANTES de publicar o código novo.
- [ ] Configurar `NODE_ENV=production`.
- [ ] Gerar novo `JWT_SECRET` com 32+ caracteres aleatórios seguros.
- [ ] Criar novas credenciais no Google Cloud Console com o domínio de produção e desativar credenciais de desenvolvimento.
- [ ] Definir `APP_URL` com a URL canônica de produção (HTTPS).
- [ ] Configurar `CORS_ORIGIN` vazia ou exatamente igual ao domínio de produção.
- [ ] Garantir persistência e backup da pasta `uploads/`.
- [ ] Validar recebimento de IP real nos logs atrás do proxy reverso (`app.set("trust proxy", 1)`).
- [ ] Checar flags dos cookies de sessão no navegador em produção (`HttpOnly`, `Secure`, `SameSite=Lax`).

## 8. Como Retomar numa Nova Conversa
Para continuar o trabalho em uma nova sessão, inicie com o prompt:
> *"Leia `docs/TODO-LGPD.md` e o git log, confirme o estado atual do projeto e aguarde a instrução do próximo passo."*

