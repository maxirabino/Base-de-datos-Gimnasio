USE SistemaGimnasio;
GO

-- 1. Borramos la restricción molesta de la clave foránea en Actividades
IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_actividades_profesores')
BEGIN
    ALTER TABLE Actividades DROP CONSTRAINT FK_actividades_profesores;
END
GO

-- 2. Limpiamos las actividades viejas que tiraban error y cargamos las de prueba limpias
DELETE FROM Actividades;

INSERT INTO Actividades (nombre, descripcion, dia_semana, hora_inicio, hora_fin, cupo, sala, precio, profesor_id, activa)
VALUES 
('Musculación Avanzada', 'Entrenamiento de hipertrofia y fuerza con aparatos', 'Lunes', '09:00', '10:30', 20, 'Sala Principal', 6000.00, 1, 1),
('Functional Training', 'Ejercicios funcionales de alta intensidad', 'Martes', '14:00', '15:00', 15, 'Sala 2', 5500.00, 2, 1),
('Spinning & Cardio', 'Clases de ciclismo de interior con música', 'Miércoles', '18:00', '19:00', 25, 'Salón de Spinning', 5000.00, 1, 1),
('Yoga y Stretching', 'Clase de estiramiento y relajación muscular', 'Jueves', '10:00', '11:00', 20, 'Sala 3', 4500.00, 3, 1);
GO