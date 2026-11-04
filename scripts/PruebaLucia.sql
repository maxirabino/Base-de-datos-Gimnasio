USE SistemaGimnasio;
GO

-- Verificamos el ID de Lucía en Entrenadores y le creamos una clase de Musculación
DECLARE @idProfesor INT;
SELECT @idProfesor = id_entrenador FROM Entrenadores WHERE nombre = 'Lucía';

IF @idProfesor IS NOT NULL
BEGIN
    INSERT INTO Actividades (nombre, descripcion, dia_semana, hora_inicio, hora_fin, cupo, sala, precio, profesor_id, activa)
    VALUES ('Musculación Avanzada', 'Clase práctica de aparatos y peso libre', 'Lunes', '10:00', '11:00', 20, 'Sala 1', 5000.00, @idProfesor, 1);
END
GO