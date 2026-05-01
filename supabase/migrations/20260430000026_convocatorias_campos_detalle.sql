ALTER TABLE convocatorias
  ADD COLUMN IF NOT EXISTS monto_maximo          bigint,
  ADD COLUMN IF NOT EXISTS es_reembolsable       boolean,
  ADD COLUMN IF NOT EXISTS porcentaje_cofinanciamiento integer,
  ADD COLUMN IF NOT EXISTS requisitos_clave      text[],
  ADD COLUMN IF NOT EXISTS plazo_ejecucion       text,
  ADD COLUMN IF NOT EXISTS region                text;
