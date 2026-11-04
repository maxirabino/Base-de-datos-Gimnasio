USE SistemaGimnasio;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Socios') AND name = 'email')
    ALTER TABLE Socios ADD email VARCHAR(100) NULL;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Socios') AND name = 'password_hash')
    ALTER TABLE Socios ADD password_hash VARCHAR(255) NULL;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Socios') AND name = 'activo')
    ALTER TABLE Socios ADD activo BIT DEFAULT 1;
GO