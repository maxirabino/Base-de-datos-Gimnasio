-- =========================================================================
-- Tabla de acceso a la web (única tabla agregada al modelo original).
-- Vincula un login (email + contraseña) con un Socio o un Entrenador.
-- Los administradores no tienen vínculo con Socios/Entrenadores.
-- =========================================================================
IF OBJECT_ID('dbo.Usuarios', 'U') IS NULL
BEGIN
    CREATE TABLE Usuarios (
        id_usuario    INT IDENTITY(1,1) PRIMARY KEY,
        email         VARCHAR(150) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        rol           VARCHAR(20)  NOT NULL CHECK (rol IN ('admin', 'entrenador', 'socio')),
        activo        BIT NOT NULL DEFAULT 1,
        creado_en     DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        id_socio      INT NULL,
        id_entrenador INT NULL,
        FOREIGN KEY (id_socio) REFERENCES Socios(id_socio),
        FOREIGN KEY (id_entrenador) REFERENCES Entrenadores(id_entrenador),
        CONSTRAINT CK_Usuarios_vinculo CHECK (
            (rol = 'socio'      AND id_socio IS NOT NULL AND id_entrenador IS NULL) OR
            (rol = 'entrenador' AND id_entrenador IS NOT NULL AND id_socio IS NULL) OR
            (rol = 'admin'      AND id_socio IS NULL AND id_entrenador IS NULL)
        )
    );
    -- Un socio / entrenador solo puede tener una cuenta
    CREATE UNIQUE INDEX UX_Usuarios_socio ON Usuarios(id_socio) WHERE id_socio IS NOT NULL;
    CREATE UNIQUE INDEX UX_Usuarios_entrenador ON Usuarios(id_entrenador) WHERE id_entrenador IS NOT NULL;
END;
GO
