# AmoPets — guia de implantação na Hostinger

> Projeto de portfólio com dados fictícios. Antes de publicar, substitua nome, endereço, WhatsApp, e-mail, imagens, preços e textos legais pelos dados reais da operação.

## Stack e persistência

- Frontend: React 19 + Vite + TypeScript + Tailwind CSS 4 + shadcn/ui.
- Backend: Node.js LTS + Express + tRPC.
- Banco: MySQL/MariaDB via Drizzle ORM.
- Imagens de catálogo: arquivos WebP no diretório `uploads/` do backend, com referência em `product_images`.
- Pedidos: checkout sem pagamento online; o servidor recalcula itens, estoque, frete e cupom antes de registrar e abrir o WhatsApp.

## Implantação

1. No hPanel, crie um banco MySQL/MariaDB e um usuário com permissões somente no banco da aplicação.
2. Use a versão Node.js LTS disponível no painel. O projeto foi validado com Node 22 no ambiente de desenvolvimento; confirme a LTS atual da Hostinger antes de publicar.
3. Instale e valide com `pnpm install --frozen-lockfile && pnpm check && pnpm build`.
4. Configure a aplicação Node para iniciar com `pnpm start` a partir da raiz do projeto. A porta deve vir de `PORT` fornecida pela Hostinger.
5. Gere/aplique o schema usando o fluxo de migration do projeto (`pnpm drizzle-kit generate` e o mecanismo de migration da hospedagem). Não edite o banco manualmente sem atualizar `drizzle/schema.ts`.
6. Importe `database/admin_and_catalog.sql` uma vez após as migrations. Esse script é idempotente e cria o administrador inicial, 8 produtos, variantes, regras de frete, cupom, serviços e horários.
7. A credencial inicial do `/admin` está documentada no próprio SQL para a primeira entrada. Troque a senha imediatamente em produção e gere outro hash scrypt; nunca mantenha essa senha em material público.
8. Garanta que `uploads/` exista e seja gravável pelo processo Node. O upload administrativo aceita somente WebP real, extensão `.webp`, até 1 MB por arquivo e no máximo 10 arquivos por requisição. Faça backup de `uploads/` junto com o banco.
9. Aponte `amopets.com.br` (domínio fictício do portfólio) para a aplicação e habilite HTTPS.

## Variáveis de ambiente

Nunca publique `.env` real ou credenciais no repositório.

```text
DATABASE_URL=mysql://usuario:senha@host:3306/banco
JWT_SECRET=segredo-longo-e-aleatorio
CORS_ORIGIN=https://amopets.com.br
VITE_APP_ID=...
OAUTH_SERVER_URL=...
VITE_OAUTH_PORTAL_URL=...
OWNER_OPEN_ID=...
OWNER_NAME=...
PORT=porta-fornecida-pela-hostinger
```

`CORS_ORIGIN` deve ser exatamente a origem oficial, sem curingas. O site usa cookies de sessão e a conexão precisa ser HTTPS.

## Rotas e operação

- `/` — home, hero, categorias, carrosséis, localização e prova social demonstrativa.
- `/produtos` e `/produtos/:slug` — catálogo e detalhe com variantes, estoque, galeria e especificações do banco.
- `/carrinho` e `/finalizar-pedido` — carrinho local, CEP via ViaCEP, frete/cupom editáveis no admin e pedido no WhatsApp.
- `/agendamento` — serviços por porte e horários persistidos; os horários ocupados não aparecem novamente.
- `/minha-conta` — consulta de pedidos e agendamentos pelo WhatsApp.
- `/admin` — login próprio com usuário/senha e CRUD de produtos, imagens, variantes, especificações, cupons, frete, serviços, horários, pedidos e agendamentos.
- `/api/health` — health check sem segredos.

## Checklist antes de produção

- Trocar todos os dados fictícios e revisar o controlador LGPD real.
- Alterar a senha inicial do administrador e confirmar logout/sessão.
- Ativar backups MySQL e do diretório `uploads/`.
- Configurar WhatsApp real e validar a mensagem de pedido.
- Revisar regras de frete, cupons, horários, serviços e estoque no painel.
- Verificar HTTPS, `CORS_ORIGIN`, cookies, sitemap, robots.txt, domínio canônico e Search Console.
- Testar CEP, carrinho após refresh, tema, checkout, consentimento LGPD, login, CRUD, upload múltiplo WebP, remoção de imagens, confirmação de exclusões e status operacionais.
- Remover ou substituir avaliações e depoimentos demonstrativos antes de uma publicação comercial.
