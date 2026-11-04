USE SistemaGimnasio;
GO

-- 1. Crear la tabla de Actividades / Clases (si no existe)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Actividades' and xtype='U')
CREATE TABLE Actividades (
    id INT IDENTITY(1,1) PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255) NULL,
    dia_semana VARCHAR(20) NOT NULL, -- 'Lunes', 'Martes', etc.
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    cupo INT NOT NULL DEFAULT 20,
    sala VARCHAR(50) NULL,
    precio DECIMAL(10,2) DEFAULT 0.00,
    profesor_id INT NULL,
    activa BIT DEFAULT 1,
    FOREIGN KEY (profesor_id) REFERENCES Entrenadores(id_entrenador)
);
GO

-- 2. Crear la tabla de Inscripciones / Reservas de los socios (si no existe)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Inscripciones' and xtype='U')
CREATE TABLE Inscripciones (
    id INT IDENTITY(1,1) PRIMARY KEY,
    socio_id INT NOT NULL,
    actividad_id INT NOT NULL,
    estado VARCHAR(20) DEFAULT 'confirmada', -- 'confirmada', 'cancelada'
    fecha_reserva DATETIME DEFAULT SYSDATETIME(),
    FOREIGN KEY (socio_id) REFERENCES Socios(id_socio),
    FOREIGN KEY (actividad_id) REFERENCES Actividades(id)
);
GO