MIGRAÇÕES PARA PHPMYADMIN

Use estes arquivos somente para importação manual no phpMyAdmin.
Os marcadores `--> statement-breakpoint` do Drizzle foram removidos porque não são comandos SQL MySQL válidos no phpMyAdmin.

Ordem:
0000, 0001, 0002, 0003, 0004, 0005, 0006, 0007.

Se uma migração já tiver sido aplicada, não a importe novamente.
No banco atual do AmoPets, 0000 e 0001 já foram aplicadas; continue pelas posteriores que ainda estiverem pendentes.

As migrações originais continuam na pasta drizzle/ e devem ser preservadas para ferramentas do Drizzle.
