# AmoPets: GitHub → Hostinger

Este pacote foi preparado para ser colocado em um repositório GitHub privado e depois importado pela Hostinger.

## 1. Extrair o pacote

Extraia o ZIP em uma pasta local. O arquivo `package.json` deve ficar diretamente dentro da pasta extraída.

## 2. Criar o repositório no GitHub

No GitHub:

1. Clique em **New repository**.
2. Use um nome como `amopets`.
3. Escolha **Private**.
4. Não marque opções para criar README, `.gitignore` ou licença, pois esses arquivos já estão neste pacote.
5. Crie o repositório.

## 3. Enviar o código usando Git

Abra o terminal dentro da pasta extraída e execute:

```bash
git init
git branch -M main
git add .
git status
git commit -m "Versão inicial do AmoPets"
git remote add origin https://github.com/SEU_USUARIO/amopets.git
git push -u origin main
```

Substitua `SEU_USUARIO` pelo seu usuário do GitHub.

Se o GitHub solicitar autenticação, use o login pelo navegador ou um Personal Access Token. Nunca coloque tokens em arquivos do projeto.

## 4. Conferir o repositório

Antes de conectar a Hostinger, confirme no GitHub que existem na raiz:

- `package.json`;
- `client/`;
- `server/`;
- `shared/`;
- `drizzle/`;
- `uploads/`;
- `.gitignore`.

Não devem existir no repositório:

- `.env`;
- `node_modules/`;
- `dist/`;
- `.git/`;
- senhas ou chaves privadas.

## 5. Conectar à Hostinger

1. No hPanel, abra **Websites**.
2. Clique em **Add Website**.
3. Escolha **Deploy Web App**.
4. Selecione **Import repository**.
5. Clique em **Connect to GitHub**.
6. Autorize a Hostinger.
7. Selecione o repositório privado `amopets`.
8. Escolha a branch `main`.

## 6. Configurar o build na Hostinger

Use:

```text
Node.js: 22.x
Framework: Other ou Express
Output directory: dist
Install command: npm install
Build command: npm run build
Start command: npm start
Entry file: dist/index.js
```

## 7. Configurar o ambiente

Adicione no painel da Hostinger as variáveis do arquivo `HOSTINGER_ENV_TEMPLATE.txt`, substituindo os placeholders. Não publique esse arquivo como segredo nem envie credenciais ao GitHub.

As variáveis mais importantes são:

```text
NODE_ENV=production
PORT=3000
DATABASE_URL=mysql://...
JWT_SECRET=...
VITE_APP_ID=...
OAUTH_SERVER_URL=...
VITE_OAUTH_PORTAL_URL=...
OWNER_OPEN_ID=...
OWNER_NAME=...
```

## 8. Atualizar o site no futuro

Depois da primeira publicação:

```bash
git add .
git commit -m "Descreva a alteração"
git push origin main
```

Se o deploy automático estiver ativado, a Hostinger fará uma nova implantação após o push. Caso não esteja, abra o painel da aplicação e clique em **Redeploy**.

## 9. Banco e uploads

O banco MySQL da Hostinger precisa ser criado separadamente. Depois, aplique as migrações da pasta `drizzle/` e execute o script de criação do administrador.

A pasta `uploads/` contém imagens do catálogo. Valide upload e leitura de novas imagens após o primeiro deploy.
