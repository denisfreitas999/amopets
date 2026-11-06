# AmoPets — pacote para Hostinger

## Publicação rápida

1. No hPanel, crie uma aplicação Node.js (plano Business ou Cloud) e importe este projeto pelo ZIP ou GitHub.
2. Use Node.js 22.x, diretório de saída `dist`, comando de build `npm run build` e comando de inicialização `npm start`.
3. Configure as variáveis do arquivo `HOSTINGER_ENV_TEMPLATE.txt` no painel, substituindo todos os placeholders.
4. Crie o banco MySQL no hPanel e substitua `DATABASE_URL` pelas credenciais reais.
5. No phpMyAdmin do hPanel, execute `database/01_schema_completo.sql` na aba SQL para criar as 14 tabelas de uma vez.
6. Em seguida, execute `database/02_dados_iniciais.sql` para criar o administrador (`admin@amopets.com.br` / `AmoPets#2026`), fretes, serviços e cupons. Valide o login em `/admin`.
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
