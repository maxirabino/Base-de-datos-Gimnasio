IF OBJECT_ID('dbo.usuarios', 'U') IS NULL
BEGIN
  CREATE TABLE usuarios (
    id INT IDENTITY(1,1) PRIMARY KEY,
    email NVARCHAR(150) NOT NULL UNIQUE,
    password_hash NVARCHAR(255) NOT NULL,
    rol NVARCHAR(20) NOT NULL
      CONSTRAINT CK_usuarios_rol CHECK (rol IN ('admin', 'profesor', 'socio')),
    activo BIT NOT NULL CONSTRAINT DF_usuarios_activo DEFAULT 1,
    creado_en DATETIME2 NOT NULL CONSTRAINT DF_usuarios_creado DEFAULT SYSDATETIME()
  );
END;

IF OBJECT_ID('dbo.socios', 'U') IS NULL
BEGIN
  CREATE TABLE socios (
    id INT IDENTITY(1,1) PRIMARY KEY,
    usuario_id INT NOT NULL UNIQUE
      CONSTRAINT FK_socios_usuarios REFERENCES usuarios(id),
    nombre NVARCHAR(80) NOT NULL,
    apellido NVARCHAR(80) NOT NULL,
    dni NVARCHAR(20) NOT NULL UNIQUE,
    telefono NVARCHAR(30) NULL,
    fecha_nacimiento DATE NULL,
    fecha_alta DATE NOT NULL CONSTRAINT DF_socios_alta DEFAULT CAST(SYSDATETIME() AS DATE),
    estado NVARCHAR(20) NOT NULL
      CONSTRAINT DF_socios_estado DEFAULT 'activo'
      CONSTRAINT CK_socios_estado CHECK (estado IN ('activo', 'inactivo'))
  );
END;

IF OBJECT_ID('dbo.profesores', 'U') IS NULL
BEGIN
  CREATE TABLE profesores (
    id INT IDENTITY(1,1) PRIMARY KEY,
    usuario_id INT NOT NULL UNIQUE
      CONSTRAINT FK_profesores_usuarios REFERENCES usuarios(id),
    nombre NVARCHAR(80) NOT NULL,
    apellido NVARCHAR(80) NOT NULL,
    dni NVARCHAR(20) NOT NULL UNIQUE,
    telefono NVARCHAR(30) NULL,
    especialidad NVARCHAR(100) NOT NULL,
    fecha_contratacion DATE NOT NULL
      CONSTRAINT DF_profesores_contratacion DEFAULT CAST(SYSDATETIME() AS DATE),
    activo BIT NOT NULL CONSTRAINT DF_profesores_activo DEFAULT 1
  );
END;

IF OBJECT_ID('dbo.actividades', 'U') IS NULL
BEGIN
  CREATE TABLE actividades (
    id INT IDENTITY(1,1) PRIMARY KEY,
    nombre NVARCHAR(100) NOT NULL,
    descripcion NVARCHAR(500) NULL,
    profesor_id INT NOT NULL
      CONSTRAINT FK_actividades_profesores REFERENCES profesores(id),
    dia_semana NVARCHAR(15) NOT NULL
      CONSTRAINT CK_actividades_dia CHECK (
        dia_semana IN (N'Lunes', N'Martes', N'Miércoles', N'Jueves', N'Viernes', N'Sábado', N'Domingo')
      ),
    hora_inicio TIME(0) NOT NULL,
    hora_fin TIME(0) NOT NULL,
    cupo INT NOT NULL CONSTRAINT CK_actividades_cupo CHECK (cupo > 0),
    precio DECIMAL(10,2) NOT NULL CONSTRAINT CK_actividades_precio CHECK (precio >= 0),
    sala NVARCHAR(50) NOT NULL,
    activa BIT NOT NULL CONSTRAINT DF_actividades_activa DEFAULT 1,
    creada_en DATETIME2 NOT NULL CONSTRAINT DF_actividades_creada DEFAULT SYSDATETIME()
  );
END;

IF OBJECT_ID('dbo.inscripciones', 'U') IS NULL
BEGIN
  CREATE TABLE inscripciones (
    id INT IDENTITY(1,1) PRIMARY KEY,
    socio_id INT NOT NULL
      CONSTRAINT FK_inscripciones_socios REFERENCES socios(id),
    actividad_id INT NOT NULL
      CONSTRAINT FK_inscripciones_actividades REFERENCES actividades(id),
    fecha_reserva DATETIME2 NOT NULL
      CONSTRAINT DF_inscripciones_fecha DEFAULT SYSDATETIME(),
    estado NVARCHAR(20) NOT NULL
      CONSTRAINT DF_inscripciones_estado DEFAULT 'confirmada'
      CONSTRAINT CK_inscripciones_estado CHECK (estado IN ('confirmada', 'cancelada')),
    CONSTRAINT UQ_inscripciones_socio_actividad UNIQUE (socio_id, actividad_id)
  );
END;

IF OBJECT_ID('dbo.pagos', 'U') IS NULL
BEGIN
  CREATE TABLE pagos (
    id INT IDENTITY(1,1) PRIMARY KEY,
    socio_id INT NOT NULL
      CONSTRAINT FK_pagos_socios REFERENCES socios(id),
    concepto NVARCHAR(120) NOT NULL,
    monto DECIMAL(10,2) NOT NULL CONSTRAINT CK_pagos_monto CHECK (monto > 0),
    metodo_pago NVARCHAR(30) NULL,
    fecha_pago DATE NULL,
    fecha_vencimiento DATE NULL,
    estado NVARCHAR(20) NOT NULL
      CONSTRAINT DF_pagos_estado DEFAULT 'pendiente'
      CONSTRAINT CK_pagos_estado CHECK (estado IN ('pendiente', 'pagado', 'vencido')),
    registrado_en DATETIME2 NOT NULL
      CONSTRAINT DF_pagos_registrado DEFAULT SYSDATETIME()
  );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_inscripciones_actividad')
  CREATE INDEX IX_inscripciones_actividad ON inscripciones(actividad_id, estado);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_pagos_socio')
  CREATE INDEX IX_pagos_socio ON pagos(socio_id, estado);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_actividades_profesor')
  CREATE INDEX IX_actividades_profesor ON actividades(profesor_id, activa);
