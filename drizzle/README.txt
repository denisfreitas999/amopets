PASTA DRIZZLE ORM (USO INTERNO DO PROJETO)

Esta pasta contém o schema TypeScript (schema.ts), definições de relações e o histórico de migrações gerenciado pelo Drizzle ORM.

ATENÇÃO:
- NÃO utilize os arquivos desta pasta para importação manual no phpMyAdmin (eles contêm delimitadores de breakpoint internos do Drizzle).
- Para criar o banco de dados do zero no phpMyAdmin ou no terminal MySQL, utilize os scripts prontos e consolidados em:
    -> database/01_schema_completo.sql
    -> database/02_dados_iniciais.sql

Para mais detalhes e passo a passo completo, consulte database/README.md.
