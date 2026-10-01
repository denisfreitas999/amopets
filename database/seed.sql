-- Seed operacional AmoPets.
-- O administrador e o catálogo persistente são criados por database/admin_and_catalog.sql.
-- Não há produtos mockados neste arquivo.

INSERT INTO available_slots (weekday, time, active) VALUES
(1, '09:00', true), (1, '10:30', true), (1, '13:30', true), (1, '15:00', true),
(2, '09:00', true), (2, '10:30', true), (2, '13:30', true), (2, '16:30', true),
(3, '09:00', true), (3, '15:00', true), (4, '10:30', true), (4, '16:30', true),
(5, '09:00', true), (5, '13:30', true), (6, '10:30', true), (6, '15:00', true);
