import { ComingSoon } from './ComingSoon';

/**
 * Cascarón de la política de datos (AC-12.1 parcial): solo el enlace es alcanzable desde
 * Settings en 1 clic. El contenido real de `GET /api/policy` es una tarea futura.
 */
export default function Policy() {
  return <ComingSoon title="Data Policy" />;
}
