# Banco de Dados — AmoPets (MySQL / MariaDB)

Esta pasta contém os scripts oficiais e consolidados para criar e inicializar o banco de dados da **AmoPets** do zero, em qualquer ambiente (Hostinger, XAMPP local, Docker ou VPS).

---

## Como criar o banco do zero (2 passos simples)

### Passo 1: Criar a Estrutura (Tabelas)
1. Crie um banco de dados vazio (ex.: `amopets_prod` ou `amopets_dev`) com charset `utf8mb4` e collation `utf8mb4_unicode_ci`.
2. Abra o arquivo [`01_schema_completo.sql`](./01_schema_completo.sql).
3. No **phpMyAdmin** (ou no terminal MySQL):
   - Selecione o banco criado;
   - Acesse a aba **SQL**;
   - Cole o conteúdo completo do arquivo e clique em **Executar**.
4. **Resultado:** Todas as 14 tabelas oficiais serão criadas de uma só vez (produtos, variantes, imagens, pedidos com `shippingMode` e `userId`, agendamentos, clientes, regras de frete e cupons).

---

### Passo 2: Inserir os Dados Iniciais e Administrador
1. Abra o arquivo [`02_dados_iniciais.sql`](./02_dados_iniciais.sql).
2. Na aba **SQL** do mesmo banco:
   - Cole o conteúdo do arquivo e clique em **Executar**.
3. **Resultado:**
   - Cadastra o **Administrador inicial** para acesso ao painel `/admin`;
   - Inicializa o sequenciador de números de pedidos (`order_number_sequence`);
   - Cadastra as **3 regras de frete** oficiais (Bairros locais de Aracaju, Outras cidades e Outras regiões);
   - Cadastra os **serviços de banho e tosa** por porte e a **grade de horários** semanais;
   - Cadastra os **cupons** de boas-vindas padrão.

---

## Acesso Administrativo Inicial

Após rodar o script `02_dados_iniciais.sql`, acesse `/admin` com as credenciais padrão:

* **URL do Painel:** `https://seudominio.com.br/admin` (ou `http://localhost:3000/admin`)
* **Usuário / E-mail:** `admin@amopets.com.br`
* **Senha:** `AmoPets#2026`

> **Recomendação de Segurança:** Após o primeiro login em produção, altere a senha ou cadastre um novo administrador com senha forte diretamente no painel.

---

## Execução via Terminal (Alternativa ao phpMyAdmin)

Se preferir utilizar a linha de comando do MySQL:

```bash
# 1. Cria a estrutura
mysql -u USUARIO -p NOME_DO_BANCO < database/01_schema_completo.sql

# 2. Insere os dados iniciais
mysql -u USUARIO -p NOME_DO_BANCO < database/02_dados_iniciais.sql
```

