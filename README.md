# AmoPets — Petshop Afetivo

Aplicação full-stack de e-commerce para petshop, com catálogo persistente, checkout via WhatsApp, agendamento de banho e tosa e painel administrativo.

## Funcionalidades

- Catálogo de produtos persistido em MySQL;
- CRUD administrativo de produtos, variantes, estoque e imagens;
- Upload de imagens WebP de até 1 MB;
- Carrinho e checkout via WhatsApp;
- Numeração pública sequencial de pedidos;
- Persistência de itens, clientes, descontos e frete;
- Consulta de pedidos e agendamentos por WhatsApp;
- Agendamento de banho e tosa;
- Painel administrativo protegido por login;
- Atualização de status de pedidos e agendamentos;
- Cupons com validade e limite total de usos;
- Regras de frete;
- Serviços e horários de banho e tosa;
- Comprovantes PDF de pedidos e agendamentos;
- Normalização de números brasileiros para WhatsApp com código +55;
- Layout responsivo para dispositivos móveis e desktop.

## Stack

- React 19;
- Vite;
- TypeScript;
- Node.js;
- Express;
- tRPC;
- Drizzle ORM;
- MySQL;
- Tailwind CSS 4;
- PDFKit;
- Vitest.

## Requisitos

- Node.js 22.x recomendado;
- npm ou pnpm;
- MySQL 8 ou compatível;
- Git, para controle de versões;
- Conta Hostinger com suporte a Node.js para produção.

## Instalação local

```bash
npm install
```

Copie `HOSTINGER_ENV_TEMPLATE.txt` para um arquivo `.env` local e substitua os valores pelos dados do seu ambiente.

Depois execute:

```bash
npm run check
npm test
npm run build
npm start
```

Para desenvolvimento:

```bash
npm run dev
```

## Banco de dados

Configure a variável `DATABASE_URL` com a conexão MySQL no seu `.env`:

```env
DATABASE_URL=mysql://USUARIO:SENHA@localhost:3306/NOME_DO_BANCO
```

### Como criar o banco do zero (Hostinger ou Local via phpMyAdmin):
1. No **phpMyAdmin**, selecione o banco de dados da AmoPets;
2. Na aba **SQL**, execute o arquivo [`database/01_schema_completo.sql`](database/01_schema_completo.sql) para criar todas as 14 tabelas oficiais consolidadas;
3. Em seguida, execute o arquivo [`database/02_dados_iniciais.sql`](database/02_dados_iniciais.sql) para cadastrar o administrador (`admin@amopets.com.br` / `AmoPets#2026`), sequência de pedidos, regras de frete e horários;
4. Consulte [`database/README.md`](database/README.md) para o guia detalhado.

### Alternativa via CLI (Ambiente de Desenvolvimento):
Se preferir usar o terminal local com Drizzle:
```bash
pnpm db:push
```
Ou:
```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

## Variáveis de ambiente

As variáveis necessárias estão listadas em `HOSTINGER_ENV_TEMPLATE.txt`.

Nunca publique credenciais, senhas, tokens ou arquivos `.env` no GitHub. O `.gitignore` do projeto já exclui arquivos de ambiente, dependências, builds, logs e artefatos temporários.

## Deploy na Hostinger usando GitHub

1. Crie um repositório privado no GitHub;
2. Envie o conteúdo deste pacote para a branch `main`;
3. No hPanel, acesse **Websites → Add Website → Deploy Web App**;
4. Escolha **Import repository**;
5. Conecte sua conta GitHub;
6. Selecione o repositório e a branch `main`;
7. Configure:

```text
Node.js: 22.x
Framework: Other ou Express
Install command: npm install
Build command: npm run build
Start command: npm start
Output directory: dist
Entry file: dist/index.js
```

8. Cadastre as variáveis de ambiente no painel;
9. Crie e configure o banco MySQL;
10. Aplique as migrações;
11. Faça o primeiro deploy.

O roteiro detalhado está em `GITHUB_HOSTINGER.md` e `HOSTINGER_DEPLOY.md`.

## Atualizações futuras

Depois que o repositório estiver conectado à Hostinger:

```bash
git add .
git commit -m "Descreva a alteração"
git push origin main
```

A Hostinger poderá iniciar um novo deploy automaticamente a cada atualização da branch conectada.

## Segurança

- Use um `JWT_SECRET` longo e aleatório;
- Mantenha o repositório privado;
- Nunca envie `.env` para o GitHub;
- Não reutilize a senha administrativa em outros serviços;
- Faça backups periódicos do MySQL;
- Restrinja o acesso administrativo;
- Mantenha as dependências atualizadas.

## Licença

Projeto privado AmoPets. Uso, distribuição e publicação dependem da autorização do proprietário.
