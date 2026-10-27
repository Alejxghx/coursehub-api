# Sesión 18 — Verificar JWT y proteger rutas

La sesión 17 emitía un token; ahora Passport verifica su firma, vencimiento y
algoritmo antes de permitir el acceso a las rutas elegidas.

Actividad: https://epanchanaf.github.io/nestjs-course/semana-09/sesion-18

## Qué cambió

- Se instalaron `@nestjs/passport`, `passport`, `passport-jwt` y los tipos de `passport-jwt`.
- `src/auth/strategies/jwt.strategy.ts` extrae el token del encabezado Bearer,
  verifica con el mismo `JWT_SECRET`, admite HS256 y mantiene activa la caducidad.
  También comprueba en ejecución que `sub` sea un entero positivo, `email` sea
  válido y exista un vencimiento numérico. No basta un tipo de TypeScript para validar JSON.
- `AuthenticatedUser` describe la identidad segura `{ id, email }`.
- `src/auth/guards/jwt-auth.guard.ts` crea un único guard reutilizable con `AuthGuard('jwt')`.
- `AuthModule` registra Passport, estrategia y guard, y exporta el guard para otros módulos.
- `GET /auth/me` usa ese guard y devuelve únicamente `request.user`.
- `CoursesModule` importa `AuthModule`; `POST /courses` usa el mismo guard sin cambiar el DTO ni el servicio.

El orden es encabezado Bearer → guard → verificación criptográfica y de exp →
`validate(payload)` → identidad en `req.user` → pipes/DTO → controlador → servicio.
Un token inválido produce 401 antes de ejecutar el controlador. Un cuerpo inválido
con token válido produce 400 antes de ejecutar el servicio de cursos.

La estrategia obtiene la identidad del token y no consulta la base en cada petición.
No implementa cuenta activa, revocación individual, roles, propiedad de recursos
ni permisos. Una cuenta eliminada podría seguir usando un token vigente hasta
que expire o cambie el secreto; una política de estado/revocación es una ampliación futura.
La identidad segura descarta claims adicionales y nunca copia el payload completo.

## Rutas públicas y protegidas

- **Requieren JWT:** `GET /auth/me` y `POST /courses`.
- **Públicas:** `POST /auth/register`, `POST /auth/login`, las lecturas de cursos,
  `PATCH /courses/:id`, `DELETE /courses/:id` y las rutas actuales de estudiantes y matrículas.

Se protege explícitamente la creación de cursos para demostrar el mismo guard
fuera de Auth. Registro y login permanecen públicos para poder obtener la cuenta
y el token. Esta es la política acotada de la práctica: no representa una política
completa de producción. No se aplica un guard global ni se usa 403 para tokens inválidos.

## Preparación para Postman

1. Configura PostgreSQL y las variables JWT en tu `.env` local. Para iniciar usa
   `npm ci` y `npm run start:dev`. No muestres `.env` real.
2. Abre `.env.example` y captura los nombres `JWT_SECRET` y `JWT_EXPIRES_IN`.
3. Importa `postman/sesion-18.postman_collection.json`.
4. Crea un entorno privado con `practicePassword`, una contraseña de práctica de
   8 a 72 caracteres y hasta 72 bytes. `baseUrl` vale `http://localhost:3000`.
5. Ejecuta en orden. El login guarda los tokens en el entorno activo para que
   puedas enviar solicitudes manuales; no exportes ese entorno ni muestres sus valores.

## Capturas de evidencia

1. **Registro 201:** petición 01. El cuerpo muestra una referencia de variable,
   no la contraseña real. Si ya existe una cuenta, puedes reutilizarla ajustando el correo.
2. **Login 200 y payload:** petición 02. Captura **Visualize**, donde aparecen
   usuario, `sub`, `email`, `iat`, `exp` y duración, con el token completo omitido.
   El panel Body JSON contiene la credencial real: no lo captures completo.
3. **Perfil 200:** petición 03 con Authorization → Bearer Token → `{{accessToken}}`.
   Debe responder solo `id` y `email`.
4. **Perfil 401:** captura la petición 04 sin encabezado y la 05 con
   `{{tamperedToken}}`. La 06 demuestra que `Token` no sustituye a `Bearer`.
5. **Negocio sin token:** captura 07, 08 y 09. El 401 de `POST /courses` se acompaña
   del conteo antes/después que demuestra que no se creó ninguna fila.
6. **DTO con token:** captura 10 y 11. Un nivel `experto` devuelve 400 y el conteo no cambia.
7. **Creación autorizada:** captura 12 y 13. El cuerpo válido devuelve 201 y el total aumenta en uno.

El conteo de la colección supone que no hay otras personas creando/eliminando
cursos simultáneamente. Los errores de validación y reglas de nivel siguen siendo
los mismos: el guard no reemplaza al DTO ni al servicio. Los cursos no tienen
una restricción de título único; no se debe afirmar que repetir un título dará 409.
Las matrículas conservan sus reglas anteriores, pero no se protege su creación en esta práctica.

Un token expirado recibe 401 por HTTP. Para comprobarlo manualmente sin esperar
15 minutos, configura temporalmente `JWT_EXPIRES_IN=5s`, reinicia la API, haz login,
espera más de cinco segundos y repite `/auth/me`. Restaura `15m`, reinicia y haz
login de nuevo para las otras capturas. Nunca compartas el secreto para generar tokens.

## Comprobaciones automatizadas

```bash
npm run build
npm run lint
npm test
npm run test:auth
npm run test:jwt
# Con PostgreSQL y JWT configurados:
npm run test:jwt:guard
npm run test:integration
npm run test:e2e
```

La suite nueva comprueba perfil válido, token ausente, esquema incorrecto, token
mal formado, firma alterada, secreto distinto, algoritmo distinto, expiración real
por HTTP, claims inválidos, falta de exp y exclusión de claims extra en la respuesta.
También verifica que el controlador/servicio no se ejecuta con identidad inválida,
que PostgreSQL no cambia tras 401 o 400 y que el cuerpo válido crea exactamente un curso.
Los tests anteriores de cursos ahora envían una identidad de prueba firmada; la suite
nueva registra una cuenta e inicia sesión realmente para comprobar el flujo completo.

## Para explicarlo en clase

**401:** falta una identidad válida (token ausente, alterado o vencido).
**403:** existe identidad pero falta permiso; los roles se trabajan en la semana 10.
El guard se reutiliza, la estrategia verifica y prepara la identidad, y el servicio
conserva sus reglas de negocio. Tener un token válido no prueba que una persona
sea administradora; esta sesión no implementa permisos de borrar cursos.

Resultado de esta entrega: 74 pruebas correctas (31 unitarias, 42 HTTP/integración
y 1 e2e). La colección se ejecutó con sus scripts contra HTTP y PostgreSQL reales:
13 peticiones y 32 aserciones correctas. Fue una ejecución automatizada de los
scripts de colección, no una sesión gráfica de Postman. Las respuestas sin tokens
completos están en `output/sesion-18-verificacion.json`.
