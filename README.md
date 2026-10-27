# CourseHub API — Sesiones 9 a 18

Cursos, estudiantes y matrículas persistentes en PostgreSQL con NestJS y TypeORM.

## Ejecutar

Requisitos: Node.js 24 LTS con npm y PostgreSQL local (por ejemplo PostgreSQL 16, instalado con el gestor de paquetes de tu sistema). La base de datos debe existir y el usuario debe poder conectarse y crear tablas en desarrollo.

Desde la carpeta `coursehub-api`:

```powershell
npm ci
# Solo si todavía no existe:
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
# Configura las credenciales PostgreSQL en .env.
npm run build
npm run start:dev
```

La base indicada en `DATABASE_NAME` debe existir. Variables: `DATABASE_HOST`,
`DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME` y opcionalmente
`PORT` (3000 por defecto) y `NODE_ENV` (`development` por defecto). `DATABASE_PORT` usa 5432 si se omite. Nunca subas `.env` con credenciales.

`autoLoadEntities: true` incorpora las entidades registradas mediante `forFeature`.
`synchronize` crea/actualiza tablas únicamente con `NODE_ENV=development`.
En `test` y `production` es `false`: el esquema debe existir previamente. Esta
entrega no implementa ni ejecuta migraciones. No se precargan datos de ejemplo en la API.

## Sesión 18: verificar JWT y proteger rutas

La política actual exige Bearer JWT en `GET /auth/me` y `POST /courses`.
Passport verifica firma HS256 y vencimiento; `JwtStrategy` prepara una identidad
segura `{ id, email }` y el mismo `JwtAuthGuard` protege ambas rutas.
Registro y login siguen públicos. Las demás rutas conservan su acceso público
para esta práctica; todavía no se implementan roles ni permisos.

Sin token o con token inválido/expirado se responde `401` antes del controlador.
Con token válido, crear cursos mantiene sus DTOs: body inválido `400`, body
válido `201`. La estrategia no consulta el estado de la cuenta ni implementa
revocación individual.

- [Guía y pasos para las capturas](docs/sesion-18.md).
- [Colección de Postman sesión 18](postman/sesion-18.postman_collection.json).
- [PDF de cambios y evidencias](output/pdf/CoursehubAPI-Sesion-18.pdf).
- [Respuestas reales sin tokens completos](output/sesion-18-verificacion.json).

`npm run test:jwt:guard` comprueba la matriz HTTP con PostgreSQL temporal.
Se verificaron 74 pruebas (31 unitarias, 42 HTTP/integración y 1 e2e), además
de las 13 peticiones y 32 aserciones de la colección ejecutadas contra la API.
Los apartados de sesiones 16 y 17 describen sus etapas anteriores; este apartado
documenta la política vigente.

## Sesión 17: emisión de tokens JWT

El login actual devuelve `{ accessToken, user }` con estado `200` después de
comprobar bcrypt. `user` contiene solo `id`, `email` y `createdAt`; el payload
firmado contiene `sub`, `email`, `iat` y `exp`. La duración por defecto es
`15m` (900 segundos) y el algoritmo de firma es HS256.

Configura `JWT_SECRET` con un valor aleatorio local de al menos 32 caracteres
y `JWT_EXPIRES_IN=15m` en `.env`. El marcador de `.env.example` se rechaza
deliberadamente. El secreto real está excluido de Git. No publiques tokens
completos, contraseñas ni hashes. Un JWT está firmado y su payload puede leerse.

La respuesta de sesión 16 que se documenta más abajo es histórica: sus campos
ahora están dentro de `user`. Usa la [colección de sesión 17](postman/sesion-17.postman_collection.json)
para verificar el contrato vigente. Las rutas todavía no tienen guards ni roles;
la protección de Bearer corresponde a la sesión 18.

- [Guía de cambios y explicación paso a paso](docs/sesion-17.md).
- [PDF para aprender la implementación](output/pdf/CoursehubAPI-Sesion-17.pdf).
- [Resultados reales sin credenciales](output/sesion-17-verificacion.json).

`npm run test:jwt` comprueba módulo, firma, payload, errores y caducidad sin
necesitar PostgreSQL. Con tu base configurada, `npm run verify:session17` genera
evidencia HTTP real en un esquema temporal. La entrega se comprobó con 66 pruebas
y 14 comprobaciones de evidencia, incluido reinicio de Nest y PostgreSQL temporal.

## Sesión 16: inicio de sesión y entrega de Semana 8

`POST /auth/login` comprueba credenciales contra el hash persistido mediante
`bcrypt.compare`. `LoginDto` valida email y password antes de llegar al servicio;
normaliza únicamente el correo. Conserva los espacios y mayúsculas de la contraseña
y exige entre 8 y 72 caracteres y un máximo de 72 bytes UTF-8, igual que el registro.

```http
POST /auth/login
Content-Type: application/json

{
  "email": "ana@example.com",
  "password": {{practicePasswordJson}}
}
```

El cuerpo mostrado es una plantilla de Postman. El script previo convierte la
variable privada `practicePassword` a `practicePasswordJson` mediante `JSON.stringify`,
para conservar comillas, barras y espacios. Usa la misma cuenta y clave de práctica
creadas con el registro. Un login correcto devuelve `200` con únicamente `id`, `email` y
`createdAt`, los mismos datos seguros del registro. La operación no crea cuentas,
no modifica contraseñas y no devuelve un token.

`UsersService.findByEmailWithPassword` utiliza una consulta parametrizada y
`addSelect('user.passwordHash')` para recuperar el hash exclusivamente en login.
Las consultas ordinarias mantienen `select: false`. La comparación pertenece a
`AuthService`; el controlador solo recibe el DTO y fija el estado HTTP.

Una contraseña incorrecta y un correo válido que no esté registrado devuelven
exactamente el mismo cuerpo con estado `401`:

```json
{
  "statusCode": 401,
  "message": "Invalid credentials",
  "error": "Unauthorized"
}
```

El mensaje genérico evita revelar públicamente cuál de las credenciales falló.
Un correo mal formado, una contraseña corta o ausente y propiedades desconocidas
devuelven `400` antes de consultar la base. Registro conserva `201` para cuentas
nuevas y `409` para correos duplicados. Cursos, estudiantes y matrículas mantienen
sus rutas disponibles; JWT, guards y roles quedan para las siguientes semanas.

### Postman y demostración de hasta ocho minutos

Importa [la colección de sesión 16](postman/sesion-16.postman_collection.json).
Configura `baseUrl` y define `practicePassword` en el valor local privado de un
entorno de Postman; utiliza una contraseña ficticia que cumpla la validación.
La colección compartida contiene la referencia a esa variable, sin guardar su
valor. No exportes el entorno con contraseñas. Ejecuta las 14 solicitudes en orden:
se generan correos nuevos y se crean dos cuentas de práctica por ejecución.
Los registros permanecen en tu base local.

Antes de presentar, configura `.env`, inicia PostgreSQL y la API, importa la colección
y prepara el entorno privado de Postman. Los cuerpos compartidos muestran variables;
evita abrir sus valores privados, el cuerpo HTTP resuelto o la consola de solicitudes
durante una captura. Las contraseñas cortas de los casos inválidos se generan solo
durante la ejecución, sin guardar un valor fijo en la colección.

1. **0:00–1:00.** Registra la primera cuenta y muestra `201`, correo normalizado y respuesta sin hash.
2. **1:00–2:00.** Inspecciona localmente la tabla `users` y su columna `password_hash`. No copies
   contraseñas ni hashes a las capturas o documentos públicos. Para una captura
   segura puedes mostrar solamente indicadores:

   ```sql
   SELECT id, email, created_at,
          password_hash IS NOT NULL AS tiene_hash,
          password_hash LIKE '$2%' AS formato_bcrypt
   FROM users;
   ```

3. **2:00–3:00.** Registra la segunda cuenta y repite el correo de la primera en mayúsculas: `409`.
4. **3:00–4:00.** Inicia sesión correctamente: `200`, misma identidad y únicamente datos seguros.
5. **4:00–5:30.** Prueba contraseña incorrecta y correo inexistente: ambos `401`, con cuerpos idénticos.
6. **5:30–6:30.** Envía un correo inválido y una contraseña corta: `400`. La prueba automatizada
   verifica además que esos cuerpos no consultan el repositorio.
7. **6:30–8:00.** Muestra el login de la segunda cuenta y los tres listados existentes con `200`.

Las solicitudes de la colección incluyen aserciones de estado, identidad,
respuestas seguras y equivalencia de los dos errores `401`. Para evidenciar la
persistencia, reinicia la API después de registrar y repite el login correcto.
Las pruebas automatizadas también cierran y reabren Nest y su conexión antes del login.

La [evidencia de ejecución de Semana 8](output/semana-08-evidencias.md) registra
las respuestas verificadas contra PostgreSQL temporal y un reinicio real del
proceso de la API. Omite contraseñas y hashes. Este registro automatizado sirve
de comprobación previa; la presentación personal en Postman sigue el guion anterior.

### Verificación y conceptos de la sesión

`npm run test:auth` compila y ejecuta diez pruebas de registro y login con bcrypt
real y un repositorio simulado, sin necesitar PostgreSQL. Incluye la matriz de
login, normalización, contraseñas con espacios, límite de bytes, respuestas
seguras y rechazo de DTO inválido sin consultar el repositorio.

Con `.env` y PostgreSQL configurados, `npm run test:auth:persistence` comprueba el
flujo contra una base real en un esquema temporal: persistencia tras reiniciar,
hash excluido de consultas normales, selección explícita para login, unicidad
de email y registros concurrentes. También forma parte de `npm run test:integration`,
que verifica las rutas de cursos, estudiantes y matrículas. No muestra hashes ni
contraseñas. Los esquemas temporales se eliminan al terminar las pruebas.

Autenticación comprueba quién es la persona mediante sus credenciales. Una sesión
permitirá demostrarlo en peticiones posteriores; la autorización decidirá qué
acciones puede realizar. Esta entrega implementa la primera comprobación.
La contraseña no se descifra: bcrypt verifica una coincidencia usando el texto
recibido y el hash que contiene la sal y el costo. No se compara un hash nuevo
con `===`, porque distintas sales producen hashes distintos. El `401` expresa un
fallo de autenticación sin revelar si existe la cuenta; `404` revelaría esa distinción.

## Sesión 15: registro de usuarios

`User` representa una cuenta de acceso independiente de `Student`. Se añadieron
`UsersModule` (entidad y repositorio) y `AuthModule` (registro, login y bcrypt).

```http
POST /auth/register
Content-Type: application/json

{
  "email": "ana@example.com",
  "password": {{practicePasswordJson}}
}
```

Un registro válido devuelve `201` con únicamente `id`, `email` y `createdAt`.
El correo se limpia y convierte a minúsculas. Un correo duplicado devuelve `409`,
incluso si llega con otras mayúsculas o colisiona con otra solicitud simultánea.
Correo inválido, campos ausentes y contraseña fuera de longitud devuelven `400`.
La contraseña debe tener entre 8 y 72 caracteres y como máximo 72 bytes UTF-8;
no se modifica con trim ni conversión de mayúsculas.

`AuthService` calcula bcrypt con costo 12 y sal por contraseña; `UsersService`
recibe únicamente el hash para persistir. La tabla `users` contiene `id`, `email`
único, `password_hash` y `created_at`. La columna del hash usa `select: false`.
El controlador nunca devuelve la entidad completa ni registra la contraseña.

Con tu `.env` local configurado, ejecuta `npm ci` y `npm run start:dev` en
`NODE_ENV=development`: TypeORM creará la tabla `users`. En producción el esquema
debe prepararse mediante la estrategia de migraciones correspondiente.

Importa [la colección de sesión 15](postman/sesion-15.postman_collection.json),
define `practicePassword` en el valor local privado de un entorno de Postman y
ejecútala en orden. Sus scripts preparan `practicePasswordJson` para los cuerpos
de registro; no guardes el valor de la contraseña en la colección compartida. Incluye registro válido, duplicado con mayúsculas, ausencia de
email, ausencia de password, correo inválido y contraseña corta. Los casos `400`
y `409` no deben crear filas; el registro válido queda en la base local.

Verificación automatizada: `npm run test:auth` compila y ejecuta pruebas HTTP con
los servicios reales, bcrypt real y un repositorio simulado. Cubre normalización,
respuesta segura, longitud, caracteres multibyte, sal y costo de bcrypt, y manejo
de la colisión UNIQUE. Estas pruebas no comprueban persistencia ni restricciones
en un servidor PostgreSQL real. Para comprobarlas localmente, consulta la tabla
`users` tras registrar y reinicia la API; evita incluir hashes en capturas públicas.

La contraseña pasa del cuerpo HTTP al DTO, se procesa en `AuthService` y solo su
hash llega a PostgreSQL. El texto original existe temporalmente durante esa
solicitud; la base conserva el hash para una futura verificación de credenciales.

## Sesiones 13 y 14: configuración validada por ambiente

La sesión 13 añade Joi para validar el entorno antes de conectar a PostgreSQL.
`NODE_ENV` solo admite `development`, `test` o `production`; ambos puertos deben
ser enteros entre 1 y 65535. Host, nombre de base, usuario y contraseña son
obligatorios. La contraseña puede estar vacía en desarrollo o pruebas, pero en
producción debe contener texto. Los errores nombran la variable y la regla
incumplida, sin imprimir sus valores.

La sesión 14 centraliza las opciones de TypeORM y activa la sincronización solo
en desarrollo. Se mantienen `DATABASE_*`, equivalentes a los `DB_*` de las
páginas del curso, para conservar el contrato del proyecto.

Archivos añadidos:

- `src/config/environment.ts`: esquema Joi y validación con mensajes sin secretos.
- `src/config/database.config.ts`: conexión y política de sincronización.
- `src/config/environment.spec.ts`: pruebas de validación y de los tres ambientes.

Archivos modificados:

- `src/app.module.ts`: conecta la validación y la fábrica de TypeORM.
- `src/main.ts`: obtiene `PORT` mediante `ConfigService.getOrThrow`.
- `.env.example`: incorpora `NODE_ENV` y `PORT`, con credenciales ficticias.
- `.gitignore`: ignora `.env` y sus variantes, salvo `.env.example`.
- `package.json` y `package-lock.json`: incorporan Joi.

En Linux/macOS, prepara el entorno sin sobrescribir un archivo existente:

```bash
npm ci
cp -n .env.example .env
# Edita .env con los datos de tu PostgreSQL local.
npm run start:dev
```

La aplicación carga `.env`; las variables del proceso tienen prioridad. Los
archivos `.env.production` o similares están ignorados, pero no se seleccionan
automáticamente. En un despliegue suministra las variables desde su entorno.

Para ver el cambio de puerto en Linux/macOS:

```bash
PORT=3100 npm run start:dev
# En otra terminal:
curl http://localhost:3100/courses
```

Con una configuración local válida, `DATABASE_PORT=not-a-number npm run start`
debe fallar antes de conectarse e identificar `DATABASE_PORT`. Para comprobar los
ambientes sin tocar una base ni alterar `.env`, ejecuta:

```bash
npx vitest run src/config/environment.spec.ts
```

Las pruebas comprueban `synchronize=true` en desarrollo y `false` en test y
producción. Para una comprobación manual de producción utiliza exclusivamente
una base local cuyo esquema ya exista: `NODE_ENV=production npm run start`.
Al terminar ese proceso, la variable temporal deja de aplicarse.

`.env.example` y el README se pueden entregar; `.env` y sus variantes locales
no se comparten. Una contraseña publicada permitiría intentar acceder a la base.
Cambiar `NODE_ENV` modifica la política porque la fábrica compara su valor con
`development`; sincronizar contra datos reales podría alterar su estructura.

## Sesión 9: estudiantes persistentes

- `src/students/entities/student.entity.ts`: tabla students con correo único.
- `StudentsModule`: habilita Repository<Student>.
- `StudentsService`: utiliza find, findOneBy, create/save y remove; ya no tiene un arreglo ni nextId.
- Se conservan DTOs, normalización de correo, semestre entre 1 y 10, filtros combinables y cambios parciales.
- Un estudiante inexistente devuelve 404. Correo repetido y eliminación de un inactivo devuelven 409.
- La comprobación previa de correo facilita el mensaje. La restricción UNIQUE protege incluso solicitudes simultáneas; el error PostgreSQL 23505 también se convierte a 409.
- isActive tiene default true en la base. El DTO de creación conserva el contrato previo: enviar isActive explícitamente.

## Sesión 10: matrículas como relaciones

```text
Student 1 ---- * Enrollment * ---- 1 Course
```

- Enrollment tiene dos relaciones ManyToOne obligatorias y claves foráneas student_id y course_id.
- Student y Course tienen la relación inversa OneToMany.
- La restricción única compuesta impide repetir estudiante + curso, también bajo concurrencia.
- Entrada: `{ "studentId": 3, "courseId": 5 }`.
- Salida: `{ "id": 7, "student": { ... }, "course": { ... } }`.
- Las consultas cargan ambas relaciones explícitamente y ordenan por id ascendente.
- Estudiante o curso inexistente: 404; estudiante inactivo: 400; matrícula duplicada: 409.
- RESTRICT impide eliminar un estudiante o curso con matrículas: la API devuelve 409.
- Cancelar elimina únicamente la matrícula; los recursos relacionados se conservan.
- PostgreSQL genera los identificadores. No se debe asumir que son consecutivos ni que empiezan en 1: una operación fallida puede consumir un valor de secuencia.

El controlador valida la entrada y delega al servicio. Los repositorios realizan el acceso a datos.
`Relation<T>` evita evaluar prematuramente los tipos de entidades que se importan mutuamente en ESM.

## Sesiones 11 y 12: consultas paginadas y relacionadas

`GET /courses` acepta `level`, `page`, `limit`, `sortBy` y `order`. Por ejemplo:

```http
GET /courses?level=beginner&page=1&limit=5&sortBy=title&order=ASC
```

Los valores predeterminados son `page=1`, `limit=10`, `sortBy=id` y `order=ASC`.
`limit` admite hasta 50 registros; `sortBy` solo acepta `id`, `title` o `level` y el
ordenamiento agrega `id` como desempate estable. La respuesta usa `{ items, meta }`,
donde `meta` contiene `total`, `page`, `limit` y `totalPages`.

`GET /enrollments` combina `search`, `studentId`, `courseId`, `activeOnly`, `page`
y `limit`. La búsqueda parcial no distingue mayúsculas y se aplica al nombre del
estudiante o al título del curso. Ejemplo:

```http
GET /enrollments?search=nest&activeOnly=true&page=1&limit=5
```

La consulta usa `QueryBuilder` con joins a estudiante y curso, parámetros SQL para
la búsqueda y orden fijo por ID. `activeOnly` acepta `true` o `false`. La respuesta
también usa `{ items, meta }`; una búsqueda sin coincidencias devuelve `200`,
`items: []` y `total: 0`. En ambos endpoints `page` empieza en 1 y `limit` está
limitado a 50; los parámetros inválidos o desconocidos devuelven `400`.

## Endpoints

| Método | Ruta | Respuesta |
|---|---|---|
| POST | /auth/register | 201, usuario seguro |
| POST | /auth/login | 200, usuario seguro; 401, credenciales incorrectas |
| POST | /courses | 201 |
| GET | /courses?level=beginner&page=1&limit=10&sortBy=id&order=ASC | 200 `{ items, meta }` |
| GET / PATCH | /courses/:id | 200 |
| DELETE | /courses/:id | 200, curso eliminado |
| POST | /students | 201 |
| GET | /students?career=Software&semester=6&isActive=true | 200 |
| GET / PATCH | /students/:id | 200 |
| PATCH | /students/:id/status | 200 |
| DELETE | /students/:id | 204 |
| POST | /enrollments | 201 |
| GET | /enrollments?studentId=3&courseId=5&page=1&limit=10 | 200 `{ items, meta }` |
| GET | /students/:studentId/enrollments | 200 |
| GET | /courses/:courseId/enrollments | 200 |
| DELETE | /enrollments/:id | 204 |

Los filtros son opcionales y combinables con AND. Las rutas anidadas validan que
exista el recurso padre. Los listados paginados sin coincidencias devuelven
`{ items: [], meta: { total: 0, ... } }`.
No existe GET /enrollments/:id: para encontrar la matrícula utiliza sus filtros.

Cursos conserva únicamente los niveles beginner, intermediate y advanced en los DTOs.
PATCH conserva los campos omitidos. Un id de curso no numérico devuelve 400.

## Evidencias para entregar en Postman

Importa [la colección de sesiones 9 y 10](postman/sesiones-9-10.postman_collection.json)
o [la colección de sesiones 11 y 12](postman/sesiones-11-12.postman_collection.json).
Usa baseUrl = http://localhost:3000. Ejecútala manualmente en orden; no ejecutes toda
la colección de una vez, porque debes detener e iniciar la API entre los pasos 02 y 03.
La colección prepara correos distintos por ejecución y guarda los IDs de las respuestas.
Los cuerpos JSON de matrículas usan variables numéricas sin comillas.

1. Crear curso y estudiante activo: 201 en ambos.
2. Crear matrícula: 201; conservar su ID.
3. Detener con Ctrl+C, ejecutar nuevamente `npm run start:dev` y consultar la matrícula:
   200, mismo ID dentro de `items` y objetos student/course. Capturar también la terminal del reinicio.
4. Repetir el POST de matrícula: 409.
5. Crear otro estudiante inactivo e intentar matricularlo: 400.
6. Filtrar por estudiante y por curso: 200, incluye la matrícula en `items`.
7. Cancelar: 204. Consultar la pareja: `items: []` y `meta.total: 0`. Repetir DELETE: 404.

En cada captura muestra método, URL, body (cuando corresponda), código HTTP y respuesta.
La colección comprueba códigos, identidad de la matrícula y ausencia después de cancelar.
Estos datos de demostración permanecen en tu base; las pruebas automatizadas usan esquemas separados.

Para sesiones 11 y 12 importa la colección correspondiente y ejecuta las cinco
solicitudes en orden. Incluye un listado de cursos válido e inválido, una búsqueda
combinada de matrículas, una búsqueda vacía y un término SQL-like parametrizado.

Para sesión 9 también muestra POST /students, PATCH /students/:id, reinicio, GET /students/:id,
filtros combinados y 409 al repetir el correo. Cambiar isActive a false y eliminar debe dar 409.

## Pruebas

```powershell
npm run test:integration
npm run test:auth
npm test
npm run lint
npm run test:e2e
```

También: `npm run test:students`, `npm run test:courses`, `npm run test:enrollments`
y `npm run test:persistence`.

Las pruebas HTTP crean esquemas PostgreSQL temporales únicos y los eliminan al terminar.
No vacían las tablas del servidor utilizado en Postman. La cuenta de PostgreSQL necesita
permiso CREATE sobre la base. La prueba e2e de la ruta raíz inicia AppModule con la
configuración local y puede sincronizar el esquema de desarrollo, sin crear registros de ejemplo.

`test/persistence.http.test.mjs` verifica:

- Creación y actualización de estudiantes que sobreviven al cierre y reapertura de Nest y su conexión.
- Correo único, filtros incluyendo false y reglas de eliminación.
- Matrícula y relaciones que sobreviven a la reapertura.
- Duplicado 409, inactivo 400, filtros, cancelación persistente y conservación de estudiante/curso.
- Restricciones UNIQUE y claves foráneas directamente contra PostgreSQL.
- Solicitudes simultáneas: una creación y conflictos 409, sin duplicados.
- Restricción al borrar recursos matriculados y los tres niveles válidos de cursos.

El reinicio automatizado recrea Nest dentro del proceso de prueba. Para la evidencia
visual de entrega realiza además el reinicio real de terminal descrito arriba.

## Referencias

- [Sesión 9: estudiantes persistentes](https://epanchanaf.github.io/nestjs-course/semana-05/sesion-09)
- [Sesión 10: relaciones persistentes](https://epanchanaf.github.io/nestjs-course/semana-05/sesion-10)
- [Sesión 16: comprobar credenciales](https://epanchanaf.github.io/nestjs-course/semana-08/sesion-16)
- [Proyecto integrador de Semana 8](https://epanchanaf.github.io/nestjs-course/semana-08/proyecto-integrador)
- [Práctica previa de semana 3](SEMANA-3.md)

## Verificación realizada — 20 de octubre de 2026

Compilación y lint correctos. Pasaron 19 pruebas unitarias, 10 de autenticación
HTTP con repositorio simulado, 18 de integración HTTP con PostgreSQL 16 (incluida
persistencia y concurrencia) y 1 e2e: 48 pruebas, 0 fallidas. Se utilizó una base
temporal aislada, sin modificar la configuración local de la aplicación.

La verificación detectó y corrigió un problema previo de identificadores en
estudiantes y matrículas: la transformación global convertía `1e2` a `100` antes
de que el pipe validara el texto. Ahora esos identificadores conservan el rechazo
con `400`, y las pruebas de estudiantes usan la misma transformación global que la API.

También se reprodujeron programáticamente las 14 solicitudes y las 37 aserciones
de la colección de sesión 16 contra una aplicación aislada con PostgreSQL real,
comprobando sus variables, cuerpos y respuestas. Se incluyó una contraseña
ficticia con espacios, comillas y barra inversa para verificar su codificación JSON.
La reproducción automatizada no sustituye las capturas de Postman y del reinicio
manual que se soliciten para subir la tarea.

Después de retirar las contraseñas fijas del README y de ambas colecciones, se
verificaron nuevamente las 20 solicitudes de sesiones 15 y 16 con sus 50 aserciones.
Un login adicional tras detener e iniciar un nuevo proceso de la API confirmó
la persistencia: 21 solicitudes correctas. La ejecución duró 2,6 segundos y sus
respuestas seguras están en [la evidencia de Semana 8](output/semana-08-evidencias.md).
