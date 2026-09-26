**Collaborator:** aidlc-devsecops-agent

## Contribution

**Observación 1 — Kubernetes Secret es necesario pero no suficiente para el API key de Anthropic.**
La práctica actual establece que la clave se almacena como `Secret` de Kubernetes y nunca se commitea en claro. Esto cubre el vector más crítico (exposición en repositorio), pero presenta una laguna: en un cluster local sin cifrado de etcd (k3s/minikube/kind en configuración por defecto), los Secrets de Kubernetes se almacenan en etcd en base64 sin cifrado en reposo. Para un proyecto académico en entorno local el riesgo residual es aceptable, pero la regla actual podría inducir una falsa sensación de seguridad si el alumno escala el proyecto a un entorno real. Se recomienda añadir una nota explícita en `discovered-rules.md` que aclare que este modelo aplica exclusivamente al cluster local y que en cualquier entorno multi-usuario o cloud se requiere cifrado de etcd o un gestor de secretos externo (Vault, AWS Secrets Manager, External Secrets Operator).

**Observación 2 — La regla de no-`latest` es correcta, pero incompleta sin una política de actualización de imágenes base.**
Prohibir `latest` en manifiestos K8s commiteados es una práctica sólida de reproducibilidad y trazabilidad. Sin embargo, fijar tags sin un proceso de revisión de vulnerabilidades en imágenes base genera un riesgo opuesto: que imágenes con CVEs conocidos queden congeladas indefinidamente. Para este contexto de un solo desarrollador no se requiere un pipeline de escaneo automatizado, pero sí se debería añadir una regla complementaria mínima: revisar manualmente el advisory de la imagen base cuando se actualiza una dependencia mayor o antes de cada entrega del módulo del curso. Herramientas como `docker scout quickview` o `trivy image` son de uso gratuito y añaden cero friction para un desarrollador individual.

**Observación 3 — Ausencia de controles de validación de entrada para la subida de imágenes del usuario.**
El draft no menciona ninguna práctica de seguridad para el endpoint de subida de archivos (imagen del estudiante), que es una de las tres capas del walking skeleton. Subir archivos sin controles es el vector de ataque más frecuente en aplicaciones web. Para este proyecto se deben establecer como reglas mandatadas: (a) validación del tipo MIME del archivo en el servidor (no solo en el cliente), rechazo de cualquier tipo que no sea imagen; (b) límite de tamaño de archivo configurado tanto en el middleware de Express (e.g., `multer` con `limits.fileSize`) como en el Ingress de Kubernetes; (c) almacenamiento del archivo en una ruta con nombre generado por el servidor (no por el cliente), para evitar path traversal; y (d) rechazo explícito de contenido ejecutable disfrazado como imagen. Estos controles no añaden complejidad significativa para un proyecto académico.

**Observación 4 — Almacenamiento de datos personales: ausencia de cualquier práctica GDPR-adyacente.**
Si el proyecto almacena imágenes de estudiantes reales o cualquier dato que permita identificar a una persona (foto, nombre asociado, etc.), aplican principios mínimos de privacidad aunque sea académico y local. El draft no menciona nada al respecto. Se recomienda añadir al menos: (a) una regla de minimización de datos (no almacenar más información del usuario de la estrictamente necesaria para el caso de uso); (b) que las imágenes subidas no se retengan más allá de la sesión de análisis si no hay consentimiento explícito; y (c) que la base de datos local no sea accesible desde fuera del cluster (lo cual el cluster local ya garantiza, pero debería estar documentado como regla, no como efecto colateral). Aunque el proyecto es académico, establecer estos hábitos desde el inicio tiene valor formativo.

**Observación 5 — Postura de seguridad en supply chain es realista pero requiere un paso mínimo automatizable.**
El draft no incluye ninguna práctica de escaneo de dependencias. Para un desarrollador individual con ~5 horas/semana, exigir un pipeline de SCA (Software Composition Analysis) completo sería desproporcionado. Sin embargo, `npm audit` es un comando nativo de Node.js que se puede añadir al pipeline de CI existente (GitHub Actions o equivalente local) con cero dependencias externas. Se recomienda mandatar `npm audit --audit-level=high` como step de CI previo al merge, con la política de que un hallazgo de severidad `high` o `critical` bloquea el merge. Esto es proporcional al contexto y cubre el riesgo más común (dependencias con CVEs conocidos).

## Positions

AGREE: Almacenar la clave de API de Anthropic como `Secret` de Kubernetes y nunca commitearla — es la decisión correcta para el contexto de despliegue K8s local. La restricción de la Observación 1 es una aclaración de alcance, no una objeción a la práctica.

AGREE: NEVER commitear manifiestos con valores de `Secret` en claro (base64 en repo equivale a texto plano) — correcto y no negociable independientemente del entorno.

AGREE: NEVER usar `latest` en manifiestos K8s commiteados — práctica correcta de reproducibilidad. Se objeta la ausencia de una política complementaria de revisión de imágenes base (ver Observación 2), pero la regla en sí es válida.

OBJECT: La ausencia de cualquier control sobre el endpoint de subida de archivos es una laguna de seguridad material. El draft debe añadir reglas mandatadas para validación de tipo MIME, límite de tamaño y generación de nombre de archivo en el servidor (ver Observación 3). Sin estos controles, el walking skeleton expone una superficie de ataque no controlada desde el primer Bolt.

OBJECT: La ausencia de `npm audit` como step de CI es una omisión injustificada dado su costo cero de integración. El draft debe mandatar `npm audit --audit-level=high` como gate de CI previo al merge (ver Observación 5).

AGREE: ALWAYS añadir `.env` y archivos con secretos al `.gitignore` desde el primer commit — correcto y debe mantenerse.

None.
