-- ============================================================================
-- AMOPETS — 02. DADOS INICIAIS E CONFIGURAÇÃO OPERACIONAL
-- ============================================================================
-- Compatível com: phpMyAdmin, MySQL 8+, MariaDB 10+
-- 
-- Instruções de uso:
-- 1. Execute APÓS ter executado o script '01_schema_completo.sql';
-- 2. Este script é idempotente (pode ser executado mais de uma vez com segurança);
-- 3. Cadastra o administrador inicial para você acessar o painel /admin;
-- 4. Cadastra a sequência de pedidos, regras de frete, serviços e horários padrão.
-- ============================================================================

SET NAMES utf8mb4;

-- 1. Administrador Inicial do Painel (/admin)
-- E-mail: admin@amopets.com.br
-- Senha inicial: AmoPets#2026
-- O hash scrypt abaixo foi gerado pelo algoritmo do sistema (scrypt$salt$derived)
INSERT INTO `admin_users` (`id`, `username`, `passwordHash`, `name`, `active`)
VALUES (
  1,
  'admin@amopets.com.br',
  'scrypt$6eed8c6ebfd865de70b809b23e1126d8$3f434320fa900cb16cbaffcff8f0c84f50d323d691aecb0a83555a80d2edd8c55ac2062d9d047a562cdc0d4b3d8b4f181b893b99c83dddb4cd7e33992ac1e2db',
  'Administrador AmoPets',
  1
)
ON DUPLICATE KEY UPDATE
  `username` = VALUES(`username`),
  `name` = VALUES(`name`),
  `active` = 1;

-- 2. Inicializador da Sequência Contínua de Pedidos (inicia em 1)
INSERT INTO `order_number_sequence` (`id`, `nextNumber`)
VALUES (1, 1)
ON DUPLICATE KEY UPDATE `id` = `id`;

-- 3. Regras de Frete Padrão
-- Limpa regras anteriores se estiver montando do zero e recria a configuração base
DELETE FROM `shipping_rules`;

INSERT INTO `shipping_rules` (`id`, `ruleType`, `city`, `neighborhoods`, `mode`, `fee`, `active`) VALUES
(1, 'local_neighborhoods', 'Aracaju', 'Centro, Jardins, 13 de Julho, Atalaia, Garcia, Grageru, Luzia, Suíssa, Salgado Filho, Farolândia, Treze de Julho, Ponto Novo, Jabotiana', 'fixed', 12.00, 1),
(2, 'other_cities', 'Nossa Senhora do Socorro', 'Marcos Freire, João Alves, Taiçoca, Piabeta, Fernando Collor', 'fixed', 25.00, 1),
(3, 'other_regions', NULL, '', 'quote', 0.00, 1);

-- 4. Serviços de Banho e Tosa por Porte (Pequeno, Médio, Grande)
INSERT INTO `grooming_services` (`id`, `name`, `description`, `priceSmall`, `priceMedium`, `priceLarge`, `active`, `sortOrder`) VALUES
(1, 'Banho Simples', 'Banho relaxante com água morninha, produtos neutros hipoalergênicos, secagem completa e escovação.', 45.00, 60.00, 75.00, 1, 0),
(2, 'Banho & Tosa Higiênica', 'Banho completo mais tosa higiênica nas patinhas, barriga e região íntima, corte de unhas e limpeza de ouvidos.', 65.00, 80.00, 95.00, 1, 1),
(3, 'Tosa da Raça / Completa', 'Banho completo especial mais tosa estilizada na máquina e tesoura conforme o padrão da raça.', 85.00, 110.00, 135.00, 1, 2)
ON DUPLICATE KEY UPDATE
  `description` = VALUES(`description`),
  `priceSmall` = VALUES(`priceSmall`),
  `priceMedium` = VALUES(`priceMedium`),
  `priceLarge` = VALUES(`priceLarge`),
  `active` = 1;

-- 5. Grade de Horários Semanais de Atendimento (Segunda a Sábado)
-- Weekday: 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta, 6=Sábado
INSERT IGNORE INTO `available_slots` (`weekday`, `time`, `active`) VALUES
(1, '09:00', 1), (1, '10:30', 1), (1, '13:30', 1), (1, '15:00', 1), (1, '16:30', 1),
(2, '09:00', 1), (2, '10:30', 1), (2, '13:30', 1), (2, '15:00', 1), (2, '16:30', 1),
(3, '09:00', 1), (3, '10:30', 1), (3, '13:30', 1), (3, '15:00', 1), (3, '16:30', 1),
(4, '09:00', 1), (4, '10:30', 1), (4, '13:30', 1), (4, '15:00', 1), (4, '16:30', 1),
(5, '09:00', 1), (5, '10:30', 1), (5, '13:30', 1), (5, '15:00', 1), (5, '16:30', 1),
(6, '09:00', 1), (6, '10:30', 1), (6, '13:30', 1), (6, '15:00', 1);

-- 6. Cupons de Boas-Vindas
INSERT INTO `coupons` (`id`, `code`, `discountType`, `discountValue`, `expiresAt`, `maxUses`, `usedCount`, `active`) VALUES
(1, 'BEMVINDO', 'percentage', 10.00, '2030-12-31 23:59:59', NULL, 0, 1),
(2, 'PRIMEIRACOMPRA', 'fixed', 15.00, '2030-12-31 23:59:59', 100, 0, 1)
ON DUPLICATE KEY UPDATE
  `discountType` = VALUES(`discountType`),
  `discountValue` = VALUES(`discountValue`),
  `active` = 1;

