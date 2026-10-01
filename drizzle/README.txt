MIGRAÇÕES AMOPETS PARA PHPMYADMIN

O Drizzle usa o marcador `--> statement-breakpoint`, que não é SQL do MySQL.
Os marcadores foram removidos destes arquivos; os comandos SQL permanecem iguais.

IMPORTANTE:
- Verifique no phpMyAdmin quais tabelas já existem antes de repetir uma migração.
- Pelo resultado de 0001, provavelmente as 10 tabelas de 0001 já foram criadas. Se elas existirem, NÃO importe 0001 novamente.
- Continue com 0002, 0003, 0004, 0005, 0006 e 0007, nessa ordem.
- Se uma migração posterior disser que uma coluna/índice já existe, pare e registre qual migração foi aplicada.
