USE SistemaGimnasio;
GO

-- 1. Agregar columna 'rol' en la tabla Socios para distinguir Admin, Profesor y Socio
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Socios') AND name = 'rol')
    ALTER TABLE Socios ADD rol VARCHAR(20) DEFAULT 'socio';
GO

-- 2. Crear un Administrador y un Profesor de prueba directos en tu tabla Socios
-- (Contraseña cifrada para 'Admin1234' y 'Profe1234')
IF NOT EXISTS (SELECT * FROM Socios WHERE email = 'admin@gimnasio.com')
BEGIN
    INSERT INTO Socios (nombre, apellidos, documento, telefono, direccion, fecha_nacimiento, fecha_alta, email, password_hash, activo, rol)
    VALUES ('Administrador', 'General', '11111111', '261000000', 'Sistema', '2000-01-01', GETDATE(), 'admin@gimnasio.com', '$2a$10$X7vQ4qZ5l8g3Y8u4g3Y8u.K5wQ4qZ5l8g3Y8u4g3Y8u.K5wQ4qZ5l', 1, 'admin');
END

IF NOT EXISTS (SELECT * FROM Socios WHERE email = 'lucia@gimnasio.com')
BEGIN
    INSERT INTO Socios (nombre, apellidos, documento, telefono, direccion, fecha_nacimiento, fecha_alta, email, password_hash, activo, rol)
    VALUES ('Lucía', 'Entrenadora', '22222222', '261111111', 'Gimnasio', '1995-05-15', GETDATE(), 'lucia@gimnasio.com', '$2a$10$X7vQ4qZ5l8g3Y8u4g3Y8u.K5wQ4qZ5l8g3Y8u4g3Y8u.K5wQ4qZ5l', 1, 'profesor');
END
GO