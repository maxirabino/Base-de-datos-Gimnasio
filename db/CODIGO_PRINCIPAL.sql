USE master;
GO
--ALTER DATABASE SistemaGimnasio SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
--DROP DATABASE IF EXISTS SistemaGimnasio;
GO

CREATE DATABASE SistemaGimnasio;
GO

USE SistemaGimnasio;
GO

-- 2. tabla Sedes 
CREATE TABLE Sedes (
    id_sede INT IDENTITY(1,1) PRIMARY KEY,
    nombre_sede VARCHAR(100) NOT NULL,
    direccion VARCHAR(200) NOT NULL
);
GO

-- 3. tabla Socios
CREATE TABLE Socios (
    id_socio INT IDENTITY(1,1) PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    documento VARCHAR(20) UNIQUE NOT NULL,
    telefono VARCHAR(20),
    direccion VARCHAR(200),
    fecha_nacimiento DATE,
    fecha_alta DATE DEFAULT GETDATE(),
    estado_membresia VARCHAR(20) CHECK (estado_membresia IN ('Activo', 'Vencido'))
);
GO

-- 4. tabla Control Ingresos
CREATE TABLE Control_Ingresos (
    id_ingreso INT IDENTITY(1,1) PRIMARY KEY,
    id_socio INT NOT NULL,
    id_sede INT NOT NULL,
    fecha DATE DEFAULT GETDATE(),
    hora_ingreso TIME NOT NULL,
    hora_egreso TIME,
    FOREIGN KEY (id_socio) REFERENCES Socios(id_socio),
    FOREIGN KEY (id_sede) REFERENCES Sedes(id_sede)
);
GO

-- 5. tabla Membresias
CREATE TABLE Membresias (
    id_membresia INT IDENTITY(1,1) PRIMARY KEY,
    tipo_plan VARCHAR(50) NOT NULL CHECK (tipo_plan IN ('Mensual', 'Trimestral', 'Anual', 'Pase Diario')),
    costo DECIMAL(10,2) NOT NULL,
    promocion_descripcion VARCHAR(200)
);
GO

-- 6. Tabla Pagos
CREATE TABLE Pagos (
    id_pago INT IDENTITY(1,1) PRIMARY KEY,
    id_socio INT NOT NULL,
    id_membresia INT NOT NULL,
    monto_abonado DECIMAL(10,2) NOT NULL,
    fecha_pago DATE DEFAULT GETDATE(),
    fecha_vencimiento DATE NOT NULL,
    metodo_pago VARCHAR(50) CHECK (metodo_pago IN ('Efectivo', 'Tarjeta', 'Transferencia')),
    FOREIGN KEY (id_socio) REFERENCES Socios(id_socio),
    FOREIGN KEY (id_membresia) REFERENCES Membresias(id_membresia)
);
GO

-- 7. tabla Entrenadores
CREATE TABLE Entrenadores (
    id_entrenador INT IDENTITY(1,1) PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    telefono VARCHAR(20),
    especialidad VARCHAR(100),
    certificaciones VARCHAR(200)
);
GO

-- 8. tabla Rutinas
CREATE TABLE Rutinas (
    id_rutina INT IDENTITY(1,1) PRIMARY KEY,
    nombre_rutina VARCHAR(100) NOT NULL,
    objetivo VARCHAR(150),
    nivel VARCHAR(50) CHECK (nivel IN ('Principiante', 'Intermedio', 'Avanzado')),
    duracion_semanas INT
);
GO

-- 9. tabla Ejercicios
CREATE TABLE Ejercicios (
    id_ejercicio INT IDENTITY(1,1) PRIMARY KEY,
    id_rutina INT NOT NULL,
    nombre_ejercicio VARCHAR(100) NOT NULL,
    grupo_muscular VARCHAR(50),
    series INT,
    repeticiones INT,
    carga_kg DECIMAL(5,2),
    FOREIGN KEY (id_rutina) REFERENCES Rutinas(id_rutina) ON DELETE CASCADE
);
GO

-- 10. tabla Rutinas Personalizadas
CREATE TABLE Rutinas_Personalizadas (
    id_asignacion INT IDENTITY(1,1) PRIMARY KEY,
    id_socio INT NOT NULL,
    id_entrenador INT NOT NULL,
    id_rutina INT NOT NULL,
    fecha_asignacion DATE DEFAULT GETDATE(),
    observaciones VARCHAR(250),
    FOREIGN KEY (id_socio) REFERENCES Socios(id_socio),
    FOREIGN KEY (id_entrenador) REFERENCES Entrenadores(id_entrenador),
    FOREIGN KEY (id_rutina) REFERENCES Rutinas(id_rutina)
);
GO

-- 11. tabla Evolucion Fisica
CREATE TABLE Evolucion_Fisica (
    id_evolucion INT IDENTITY(1,1) PRIMARY KEY,
    id_socio INT NOT NULL,
    fecha_registro DATE DEFAULT GETDATE(),
    peso_kg DECIMAL(5,2) NOT NULL,
    porcentaje_grasa DECIMAL(4,2),
    masa_muscular_kg DECIMAL(5,2),
    observaciones VARCHAR(250),
    FOREIGN KEY (id_socio) REFERENCES Socios(id_socio)
);
GO