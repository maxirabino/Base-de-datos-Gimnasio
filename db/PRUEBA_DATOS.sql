USE SistemaGimnasio;
GO

-- =========================================================================
-- 1. Sedes
-- =========================================================================
INSERT INTO Sedes (nombre_sede, direccion) VALUES 
('Sede Centro', 'San Martín 450, Mendoza'),
('Sede Godoy Cruz', 'Av. Rivadavia 1200, Mendoza');
GO

-- =========================================================================
-- 2. Membresias
-- =========================================================================
INSERT INTO Membresias (tipo_plan, costo, promocion_descripcion) VALUES 
('Mensual', 25000.00, 'Sin promo'),
('Trimestral', 65000.00, '10% de descuento abonando en efectivo'),
('Anual', 220000.00, 'Plan anual bonificado'),
('Pase Diario', 4000.00, 'Acceso por 1 día');
GO

-- =========================================================================
-- 3. Entrenadores
-- =========================================================================
INSERT INTO Entrenadores (nombre, apellido, telefono, especialidad, certificaciones) VALUES 
('Carlos', 'Gómez', '2615551234', 'Musculación e Hipertrofia', 'Certificado ISAK Nivel 1, Preparador Físico'),
('Mariana', 'López', '2615555678', 'Functional Training y Cross', 'Coach Crossfit Level 2');
GO

-- =========================================================================
-- 4. Rutinas
-- =========================================================================
INSERT INTO Rutinas (nombre_rutina, objetivo, nivel, duracion_semanas) VALUES 
('Rutina Base Hipertrofia', 'Ganancia muscular', 'Intermedio', 4),
('Rutina Definición Básica', 'Pérdida de tejido graso', 'Principiante', 4),
('Fuerza Base Piernas', 'Ganancia de fuerza en sentadillas y peso muerto', 'Avanzado', 6);
GO

-- =========================================================================
-- 5. Ejercicios
-- =========================================================================
INSERT INTO Ejercicios (id_rutina, nombre_ejercicio, grupo_muscular, series, repeticiones, carga_kg) VALUES 
(1, 'Press Banca Plano', 'Pecho', 4, 10, 70.00),
(1, 'Dominadas en Barra', 'Espalda', 3, 8, 0.00),
(3, 'Sentadilla Libre', 'Piernas', 5, 5, 100.00),
(2, 'Plancha Abdominal', 'Core', 3, 1, 0.00);
GO

-- =========================================================================
-- 6. Socios/Clientes
-- =========================================================================
INSERT INTO Socios (nombre, apellidos, documento, telefono, direccion, fecha_nacimiento, estado_membresia) VALUES 
('Juan', 'Pérez', '42111222', '2614441111', 'Belgrano 320, Mendoza', '2001-05-12', 'Activo'),
('Lucía', 'Martínez', '40333444', '2614442222', 'España 789, Mendoza', '1999-09-20', 'Activo'),
('Esteban', 'Quito', '38555666', '2614443333', 'Las Heras 150, Mendoza', '1995-02-14', 'Vencido');
GO

-- =========================================================================
-- 7. Insertar Pagos
-- =========================================================================
INSERT INTO Pagos (id_socio, id_membresia, monto_abonado, fecha_pago, fecha_vencimiento, metodo_pago) VALUES 
(1, 1, 25000.00, '2026-10-01', '2026-11-01', 'Efectivo'),
(2, 2, 65000.00, '2026-09-15', '2026-12-15', 'Transferencia'),
(3, 1, 25000.00, '2026-08-01', '2026-09-01', 'Tarjeta'); -- Este socio tiene cuota vencida
GO

-- =========================================================================
-- 8. Control de Ingresos
-- =========================================================================
INSERT INTO Control_Ingresos (id_socio, id_sede, fecha, hora_ingreso, hora_egreso) VALUES 
(1, 1, '2026-10-26', '14:30:00', '16:15:00'), -- Lunes
(2, 1, '2026-10-26', '15:00:00', '16:45:00'), -- Lunes
(3, 1, '2026-10-27', '08:00:00', '09:30:00'), -- Martes
(1, 2, '2026-10-27', '18:00:00', '19:45:00'), -- Martes
(2, 1, '2026-10-28', '14:00:00', '15:30:00'), -- Miércoles
(1, 1, '2026-10-28', '16:00:00', '18:15:00'), -- Miércoles
(3, 2, '2026-10-28', '19:00:00', '20:30:00'), -- Miércoles
(2, 1, '2026-10-29', '10:00:00', '11:15:00'); -- Jueves
GO

-- =========================================================================
-- 9. Rutinas Personalizadas
-- =========================================================================
INSERT INTO Rutinas_Personalizadas (id_socio, id_entrenador, id_rutina, observaciones) VALUES 
(1, 1, 1, 'Buen progreso en pecho, cuidar postura en press.'),
(2, 2, 2, 'Enfocarse en la pérdida de grasa y constancia.');
GO

-- =========================================================================
-- 10. Evolución Física
-- =========================================================================
INSERT INTO Evolucion_Fisica (id_socio, fecha_registro, peso_kg, porcentaje_grasa, masa_muscular_kg, observaciones) VALUES 
(1, '2026-10-01', 78.50, 14.50, 39.10, 'Excelente evolución en masa muscular.'),
(2, '2026-10-15', 62.00, 22.00, 26.50, 'Evaluación inicial para plan de definición.');
GO