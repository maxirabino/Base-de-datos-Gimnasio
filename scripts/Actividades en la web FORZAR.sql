USE SistemaGimnasio;
GO
-- Forzamos a que todas las actividades estén activas para que salgan en la web
UPDATE Actividades SET activa = 1;
GO