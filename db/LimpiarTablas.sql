USE SistemaGimnasio;
GO

-- 1. Desactivar temporalmente las restricciones de Foreign Keys para poder borrar sin problemas de orden
EXEC sp_MSforeachtable 'ALTER TABLE ? NOCHECK CONSTRAINT ALL';
GO

-- 2. Borrar todos los registros de las tablas principales y secundarias
DELETE FROM Usuarios; -- (tabla de login de la web; va primero porque referencia Socios/Entrenadores)
DELETE FROM Control_Ingresos;
DELETE FROM Pagos;
DELETE FROM Evolucion_Fisica;
DELETE FROM Rutinas_Personalizadas;
DELETE FROM Ejercicios;
DELETE FROM Rutinas;
DELETE FROM Entrenadores;
DELETE FROM Membresias;
DELETE FROM Socios;
DELETE FROM Sedes;
GO

-- 3. Volver a activar las restricciones de integridad
EXEC sp_MSforeachtable 'ALTER TABLE ? CHECK CONSTRAINT ALL';
GO

-- 4. Reiniciar los contadores de los ID en 0 para que los nuevos arranquen desde el 1
DBCC CHECKIDENT ('Usuarios', RESEED, 0);
DBCC CHECKIDENT ('Sedes', RESEED, 0);
DBCC CHECKIDENT ('Socios', RESEED, 0);
DBCC CHECKIDENT ('Membresias', RESEED, 0);
DBCC CHECKIDENT ('Entrenadores', RESEED, 0);
DBCC CHECKIDENT ('Rutinas', RESEED, 0);
DBCC CHECKIDENT ('Ejercicios', RESEED, 0);
DBCC CHECKIDENT ('Pagos', RESEED, 0);
DBCC CHECKIDENT ('Control_Ingresos', RESEED, 0);
DBCC CHECKIDENT ('Evolucion_Fisica', RESEED, 0);
DBCC CHECKIDENT ('Rutinas_Personalizadas', RESEED, 0);
GO