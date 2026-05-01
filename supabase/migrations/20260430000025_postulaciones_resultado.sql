ALTER TABLE postulaciones
  ADD COLUMN IF NOT EXISTS resultado text
    CHECK (resultado IN ('en_evaluacion', 'adjudicada', 'no_adjudicada', 'desistida')),
  ADD COLUMN IF NOT EXISTS monto_adjudicado text;
