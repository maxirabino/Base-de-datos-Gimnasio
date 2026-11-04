USE SistemaGimnasio;
GO

-- =========================================================================
-- 1. REPORTE FINANCIERO
-- =========================================================================
SELECT '=== FACTURACION X METODO DE PAGO ===' AS Titulo_Seccion;
SELECT 
    metodo_pago,
    COUNT(*) AS Cantidad_Pagos,
    SUM(monto_abonado) AS Recaudacion_Total
FROM Pagos
GROUP BY metodo_pago;
GO

-- =========================================================================
-- 2. CONTROL DE ACCESOS
-- =========================================================================
SELECT '=== CONTROL DE ACCESOS: ASISTENCIAS ===' AS Titulo_Seccion;
SELECT 
    s.id_socio,
    s.nombre,
    s.apellidos,
    s.estado_membresia,
    COUNT(ci.id_ingreso) AS Total_Asistencias
FROM Socios s
LEFT JOIN Control_Ingresos ci ON s.id_socio = ci.id_socio
GROUP BY s.id_socio, s.nombre, s.apellidos, s.estado_membresia
ORDER BY Total_Asistencias DESC;
GO

-- =========================================================================
-- 3. GESTION DE ENTRENAMIENTO
-- =========================================================================
SELECT '=== RUTINAS PERSONALIZADAS ===' AS Titulo_Seccion;
SELECT 
    s.nombre + ' ' + s.apellidos AS Socio,
    e.nombre + ' ' + e.apellido AS Entrenador_Asignado,
    r.nombre_rutina,
    r.objetivo,
    r.nivel,
    rp.fecha_asignacion,
    rp.observaciones
FROM Rutinas_Personalizadas rp
JOIN Socios s ON rp.id_socio = s.id_socio
JOIN Entrenadores e ON rp.id_entrenador = e.id_entrenador
JOIN Rutinas r ON rp.id_rutina = r.id_rutina;
GO

-- =========================================================================
-- 4. EJERCICIOS
-- =========================================================================
SELECT '=== DETALLE DE EJERCICIOS X RUTINA ===' AS Titulo_Seccion;
SELECT 
    r.nombre_rutina,
    r.nivel AS Nivel_Rutina,
    e.nombre_ejercicio,
    e.grupo_muscular,
    e.series,
    e.repeticiones,
    e.carga_kg
FROM Rutinas r
JOIN Ejercicios e ON r.id_rutina = e.id_rutina;
GO

-- =========================================================================
-- 5. SEGUIMIENTO DE SALUD CLIENTES
-- =========================================================================
SELECT '=== SEGUIMIENTO DE SALUD: EV FISICA ===' AS Titulo_Seccion;
SELECT 
    s.nombre,
    s.apellidos,
    ef.fecha_registro,
    ef.peso_kg,
    ef.porcentaje_grasa,
    ef.masa_muscular_kg,
    ef.observaciones AS Notas_Evolucion
FROM Socios s
JOIN Evolucion_Fisica ef ON s.id_socio = ef.id_socio;
GO

-- =========================================================================
-- 6. ESTADO DE CUOTAS
-- =========================================================================
SELECT '=== PERMANENCIA Y ESTADO DE CUOTAS DE SOCIOS ===' AS Titulo_Seccion;
SELECT 
    s.nombre,
    s.apellidos,
    m.tipo_plan,
    p.monto_abonado,
    p.fecha_pago,
    p.fecha_vencimiento,
    CASE 
        WHEN p.fecha_vencimiento >= GETDATE() THEN 'Cuota al día (Vigente)'
        ELSE 'Cuota Vencida'
    END AS Estado_Cuota
FROM Socios s
JOIN Pagos p ON s.id_socio = p.id_socio
JOIN Membresias m ON p.id_membresia = m.id_membresia;
GO

USE SistemaGimnasio;
GO

-- 1. Configuramos el idioma español para esta sesión
SET LANGUAGE 'Spanish';
GO

-- =========================================================================
-- 7. Tiempo de estadia por socio y visita
-- =========================================================================
SELECT '=== TIEMPO DE ESTADIA X SOCIO Y VISITA ===' AS Titulo_Seccion;
SELECT 
    s.nombre + ' ' + s.apellidos AS Socio,
    ci.fecha,
    DATENAME(WEEKDAY, ci.fecha) AS Dia_Semana,
    ci.hora_ingreso,
    ci.hora_egreso,
    DATEDIFF(MINUTE, ci.hora_ingreso, ci.hora_egreso) AS Minutos_En_Gimnasio,
    CAST(DATEDIFF(MINUTE, ci.hora_ingreso, ci.hora_egreso) / 60.0 AS DECIMAL(4,2)) AS Horas_En_Gimnasio
FROM Control_Ingresos ci
JOIN Socios s ON ci.id_socio = s.id_socio
ORDER BY ci.fecha DESC;
GO

-- =========================================================================
-- 8. Dias de la semana con mas ingresos al gimnasio
-- =========================================================================
SELECT '=== ZONAS CALIENTES (DIAS CON MAYORES INGRESOS DE CLIENTES) ===' AS Titulo_Seccion;
SELECT 
    DATENAME(WEEKDAY, fecha) AS Dia_Semana,
    COUNT(id_ingreso) AS Total_Socios_Ingresados
FROM Control_Ingresos
GROUP BY DATENAME(WEEKDAY, fecha), DATEPART(WEEKDAY, fecha)
ORDER BY Total_Socios_Ingresados DESC;
GO