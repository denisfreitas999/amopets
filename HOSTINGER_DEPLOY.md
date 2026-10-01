# AmoPets — pacote para Hostinger

## Publicação rápida

1. No hPanel, crie uma aplicação Node.js (plano Business ou Cloud) e importe este projeto pelo ZIP ou GitHub.
2. Use Node.js 22.x, diretório de saída `dist`, comando de build `npm run build` e comando de inicialização `npm start`.
3. Configure as variáveis do arquivo `HOSTINGER_ENV_TEMPLATE.txt` no painel, substituindo todos os placeholders.
4. Crie o banco MySQL no hPanel e substitua `DATABASE_URL` pelas credenciais reais.
5. Execute a migração Drizzle com `pnpm db:push` ou gere/aplique os SQL da pasta `drizzle/` pelo phpMyAdmin.
6. Execute o script SQL de criação do administrador e valide o login em `/admin`.
7. Copie a pasta `uploads/` para a área persistente da aplicação e valide as imagens do catálogo.
8. Aponte o domínio, ative SSL e atualize os callbacks OAuth para o domínio de produção.

## Comandos locais de verificação

```bash
npm install
npm run check
npm test
npm run build
npm start
```

O pacote não contém `node_modules`, `dist`, `.git`, `.env`, logs, tokens ou senhas.
