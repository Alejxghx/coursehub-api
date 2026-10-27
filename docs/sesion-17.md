# Sesión 17 — Emitir un JWT después del login

La API ahora entrega un token de acceso cuando las credenciales son correctas.
La sesión 16 devolvía el usuario directamente; la sesión 17 devuelve
`{ accessToken, user }`. El registro conserva `201` y los campos seguros de usuario.

Fuente de la actividad: https://epanchanaf.github.io/nestjs-course/semana-09/sesion-17

## Qué se agregó y qué se modificó

- `package.json` y `package-lock.json`: dependencia `@nestjs/jwt` y comandos de comprobación.
- `src/auth/types/jwt-payload.type.ts`: tipo nuevo con `sub: number` y `email: string`.
- `src/auth/auth.module.ts`: `JwtModule.registerAsync` lee secreto y caducidad de `ConfigService`; firma con HS256.
- `src/auth/auth.service.ts`: inyecta `JwtService`, separa `validateCredentials` y firma después de bcrypt.
- `src/config/environment.ts`: exige `JWT_SECRET` y valida `JWT_EXPIRES_IN` (15m por defecto).
- `.env.example`: documenta las dos variables sin incluir el secreto local real.
- `test/jwt.http.test.mjs`: prueba el módulo real de JWT, credenciales, payload, firma, caducidad y cambio de secreto.
- `src/config/environment.spec.ts`: prueba los nuevos requisitos de configuración.
- `test/auth.http.test.mjs` y `test/auth.persistence.http.test.mjs`: leen los datos seguros desde `body.user`.
- `test/database.mjs`: permite recibir configuración directamente del entorno aunque no exista `.env`.
- `test/session-17-evidence.mjs`: genera evidencia real con PostgreSQL temporal, sin escribir credenciales.
- `postman/sesion-17.postman_collection.json`: ocho peticiones para registro, login y comprobación de rutas existentes.
- `output/sesion-17-verificacion.json`: resultados reales sin contraseña, hash, secreto ni token completo.
- `output/pdf/CoursehubAPI-Sesion-17.pdf`: guía de los cambios y de las pruebas realizadas.

El repositorio remoto estaba en la sesión 15. Los cambios de sesión 16 ya presentes
en la carpeta (LoginDto, controlador y búsqueda explícita del hash) se incluyen
como base del nuevo login. Las correcciones previas de parámetros en estudiantes
y matrículas también se conservan; no son requisitos nuevos de JWT.

## Antes y después

Antes, `login` comprobaba bcrypt y devolvía directamente:

```ts
return { id: user.id, email: user.email, createdAt: user.createdAt };
```

Ahora, `validateCredentials` conserva esa comprobación y entrega el usuario seguro.
Solo si termina correctamente, `login` construye el payload mínimo y firma:

```ts
const user = await this.validateCredentials(dto.email, dto.password);
const payload: JwtPayload = { sub: user.id, email: user.email };
return {
  accessToken: await this.jwtService.signAsync(payload),
  user,
};
```

Un `throw new UnauthorizedException('Invalid credentials')` interrumpe el flujo:
no se llega a `signAsync` ni se entrega token.

## Configuración local

```bash
npm ci
# Si todavía no existe .env:
cp .env.example .env
```

Configura PostgreSQL en `.env`. Después genera un secreto en tu equipo con
`crypto.randomBytes(48).toString('hex')` y guárdalo como `JWT_SECRET` únicamente
en ese archivo. La implementación preparó un `.env` local ignorado por Git con
un secreto aleatorio; sus datos de conexión deben corresponder a tu PostgreSQL.
No ejecutes `cp .env.example .env` sobre ese archivo ya preparado.

`JWT_EXPIRES_IN=15m` equivale a 900 segundos. Se admiten duraciones positivas con
unidad explícita `s`, `m`, `h` o `d`, de uno a seis dígitos. Se rechazan valores
como `900` (sin unidad), `0s`, `-1m` o `never`. Una cadena numérica sin unidad
podría interpretarse como milisegundos por la biblioteca; por eso se valida.
El marcador de ejemplo `replace-with-a-long-random-local-secret` se rechaza.
La aplicación falla al iniciar si falta el secreto o tiene menos de 32 caracteres.

```bash
npm run build
npm run start:dev
```

## Qué contiene el JWT

El token tiene tres segmentos separados por puntos: header, payload y firma.
El payload es legible mediante Base64URL. La firma permite detectar alteraciones;
no cifra el contenido. Decodificar no comprueba firma ni vencimiento.

- `sub`: identificador numérico del usuario.
- `email`: correo normalizado.
- `iat`: instante de emisión, añadido por la biblioteca, en segundos Unix.
- `exp`: vencimiento, añadido por la biblioteca, también en segundos Unix.

No se firma la entidad completa. `createdAt` permanece en `user` pero no se añade
al payload. Contraseña, hash y secreto de firma quedan fuera de la respuesta y
del token. Un JWT no debe contener datos bancarios ni otros datos confidenciales.

Esta sesión solo emite tokens. Los listados de cursos, estudiantes y matrículas
siguen públicos. Agregar un encabezado Bearer no protege una ruta por sí solo:
la estrategia y el guard de la sesión 18 verificarán el token en cada petición.
No se implementan roles, refresh tokens ni revocación individual en esta sesión.
Un token emitido sigue siendo una credencial hasta que expire; cambiar el secreto
invalida los tokens firmados con el valor anterior al verificarlos con el nuevo.

## Postman paso a paso

1. Importa `postman/sesion-17.postman_collection.json` y configura `baseUrl`.
2. Define `practicePassword` en el valor privado de un entorno. Usa solo una clave de práctica de 8 a 72 caracteres y hasta 72 bytes.
3. Ejecuta la colección en orden. El registro crea un correo único y guarda solo los datos seguros del usuario para comparar respuestas.
4. El login válido debe devolver `200`, `accessToken` y `user`. La colección decodifica el payload localmente y comprueba sus campos y `exp - iat = 900`.
5. Password incorrecta y correo inexistente deben devolver el mismo `401`, sin token. Un DTO inválido devuelve `400`.
6. Los tres listados existentes deben seguir respondiendo `200`.

La colección no guarda el token en variables de colección ni lo envía a servicios
externos. Decodificar en Postman no demuestra que la firma sea válida; las pruebas
con `JwtService.verifyAsync` sí lo comprueban. Si cambias la duración, ajusta la
variable `expectedLifetimeSeconds` para que coincida y restaura `15m` al terminar.
La colección de sesión 16 conserva el contrato histórico previo; utiliza la de
sesión 17 para el nuevo formato de login. No exportes historiales con tokens reales.

## Comprobaciones y resultados

```bash
npm run build
npm run lint
npm test
npm run test:auth
npm run test:jwt
# Con variables de conexión a PostgreSQL y JWT configuradas:
npm run test:integration
npm run test:e2e
npm run verify:session17
```

La ejecución de esta entrega pasó 66 pruebas: 31 unitarias, 10 HTTP de registro/login,
6 HTTP de JWT, 18 de integración con PostgreSQL y 1 de arranque e2e.
El generador de evidencia realizó otras 14 comprobaciones reales contra PostgreSQL
en un esquema temporal que se eliminó al terminar. No se alteraron bases existentes.

Se verificaron registro `201`, duplicado `409`, login `200`, errores de credenciales
`401`, DTO inválido `400`, payload mínimo, vencimiento de 900 segundos, alteración de
firma, cambio de secreto, reinicio de Nest con persistencia y tres rutas existentes.
También se ejecutó el proceso real sin `JWT_SECRET`: terminó con error de
configuración antes de abrir la conexión de base de datos.

La prueba corta firma un token de `1s` y mueve el reloj de verificación hasta `exp`:
se obtiene `TokenExpiredError` sin esperar un segundo real. La configuración normal
permanece en `15m`. Esto prueba la caducidad de la biblioteca; el rechazo HTTP de
Bearer en rutas protegidas será parte de la sesión 18.

## Para comprobar que lo entendiste

1. ¿Por qué la firma está después de `validateCredentials`? Porque una contraseña incorrecta debe interrumpir la operación antes de emitir una credencial.
2. ¿Por qué `sub` y no toda la entidad? Porque identifica al usuario sin copiar hashes ni campos innecesarios.
3. ¿Qué tres datos nunca pondrías en el payload? Contraseña (da acceso), hash (permite ataques fuera de línea) y secreto JWT (permite falsificar tokens).
4. ¿Qué prueba la firma? Que el contenido no fue alterado respecto de quien posee el secreto; no demuestra que el payload sea confidencial.
5. ¿Por qué expira? Para limitar el tiempo de uso de una credencial, incluso cuando su firma todavía es válida.
6. ¿Por qué dos logins pueden producir el mismo token? La identidad, el secreto y los tiempos en segundos pueden ser iguales si ambos ocurren en el mismo segundo.
