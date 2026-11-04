USE SistemaGimnasio;
GO

-- Asegurar que la tabla Pagos tenga las columnas de estado y concepto si faltaban
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Pagos') AND name = 'estado')
    ALTER TABLE Pagos ADD estado VARCHAR(20) DEFAULT 'pagado';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Pagos') AND name = 'concepto')
    ALTER TABLE Pagos ADD concepto VARCHAR(100) DEFAULT 'Cuota Mensual';
GO