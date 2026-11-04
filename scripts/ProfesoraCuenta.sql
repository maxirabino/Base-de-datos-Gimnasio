USE SistemaGimnasio;
GO

-- 1. Creamos al Administrador en la tabla Socios
IF NOT EXISTS (SELECT * FROM Socios WHERE email = 'admin@gimnasio.com')
BEGIN
    INSERT INTO Socios (nombre, apellidos, documento, telefono, direccion, fecha_nacimiento, fecha_alta, email, password_hash, activo, rol)
    VALUES ('Administrador', 'General', '11111111', '261000000', '', '2000-01-01', GETDATE(), 'admin@gimnasio.com', '$2a$10$X7vQ4qZ5l8g3Y8u4g3Y8u.K5wQ4qZ5l8g3Y8u4g3Y8u.K5wQ4qZ5l', 1, 'admin');
END

-- 2. Creamos a Lucía en la tabla Socios (para que pueda loguearse)
IF NOT EXISTS (SELECT * FROM Socios WHERE email = 'lucia@gimnasio.com')
BEGIN
    INSERT INTO Socios (nombre, apellidos, documento, telefono, direccion, fecha_nacimiento, fecha_alta, email, password_hash, activo, rol)
    VALUES ('Lucía', 'Entrenadora', '22222222', '261111111', '', '1995-05-15', GETDATE(), 'lucia@gimnasio.com', '$2a$10$X7vQ4qZ5l8g3Y8u4g3Y8u.K5wQ4qZ5l8g3Y8u4g3Y8u.K5wQ4qZ5l', 1, 'profesor');
END

-- 3. Creamos a Lucía en tu tabla Entrenadores (para asignarle las clases)
IF NOT EXISTS (SELECT * FROM Entrenadores WHERE nombre = 'Lucía' AND apellido = 'Entrenadora')
BEGIN
    INSERT INTO Entrenadores (nombre, apellido, telefono, especialidad)
    VALUES ('Lucía', 'Entrenadora', '261111111', 'Musculación');
END
GO