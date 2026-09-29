# CourseHub API — Cursos, Estudiantes y Matrículas

## Sesión 8: PostgreSQL y CRUD persistente

Requisitos: Node.js compatible con NestJS 12, npm y un servidor PostgreSQL disponible.
Crea la base de datos `coursehub` en PostgreSQL (`CREATE DATABASE coursehub;`).
Copia `.env.example` a `.env` solamente si todavía no existe y configura:

| Variable | Ejemplo |
|---|---|
| DATABASE_HOST | localhost |
| DATABASE_PORT | 5432 |
| DATABASE_NAME | coursehub |
| DATABASE_USER | postgres |
| DATABASE_PASSWORD | tu contraseña local |

`.env` está excluido de Git. `.env.example` contiene únicamente valores de ejemplo.
TypeORM registra Course mediante `forFeature` y `autoLoadEntities`; al iniciar,
`synchronize: true` crea la tabla courses. Esta configuración es para desarrollo;
en producción se deben utilizar migraciones.

El controlador y los DTOs mantienen el contrato HTTP existente.
CoursesService usa find, findOneBy, create/save y remove. PostgreSQL genera los IDs.
GET, PATCH y DELETE de un curso inexistente devuelven 404.
PATCH conserva los campos omitidos y DELETE devuelve el curso eliminado, incluido su id.
El listado se ordena por id ascendente: SQL no garantiza un orden implícito.

### Comprobar persistencia manualmente

1. Ejecuta `npm run start:dev`.
2. Envía POST /courses con `{"title":"Curso persistente de prueba","level":"beginner"}` y anota el id.
3. Detén la API con Ctrl+C, vuelve a iniciarla y consulta GET /courses/:id: debe devolver el curso.
4. Envía PATCH /courses/:id con `{"level":"intermediate"}`; reinicia y comprueba el cambio con GET.
5. Envía DELETE /courses/:id y comprueba que GET devuelve 404, también tras reiniciar.

### Pruebas automatizadas

`npm run test:courses` ejecuta el CRUD por HTTP contra PostgreSQL, cierra y vuelve a crear
la aplicación y su conexión entre operaciones para verificar la persistencia de creación,
actualización y eliminación. También verifica filtros, orden, validación y errores 404.
`npm run test:integration` incluye además Estudiantes y Matrículas.
Cada aplicación de prueba usa un esquema temporal único que elimina al terminar;
el usuario de PostgreSQL necesita permiso CREATE sobre la base de datos.
Las pruebas de Matrículas preparan sus tres cursos de ejemplo únicamente en ese esquema.

Referencia: [Sesión 8 · CRUD persistente con repositorios](https://epanchanaf.github.io/nestjs-course/semana-04/sesion-08).


API con NestJS. La sesión 8 migra Cursos a PostgreSQL mediante una entidad Course y un repositorio TypeORM. Los cursos sobreviven a los reinicios y ya no se precargan ejemplos. Estudiantes y Matrículas conservan su almacenamiento en memoria.

## Ejecutar

Desde la carpeta `coursehub-api`:

```powershell
npm ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
# Editar .env con las credenciales locales de PostgreSQL
npm run build
npm run start:dev
```

URL local: `http://localhost:3000`. La variable `PORT` permite cambiar el puerto.

## Estructura y responsabilidades

- `src/courses`: módulo, controlador, servicio y DTOs de Cursos.
- `src/students`: módulo, controlador, servicio, DTOs y Pipe de Estudiantes.
- `src/enrollments`: módulo, controlador, servicio, DTOs y Pipe de Matrículas.
- `src/app.module.ts`: registra los tres módulos.
- `src/main.ts`: activa `ValidationPipe` global con `whitelist` y `forbidNonWhitelisted`.

Cursos y Estudiantes exportan sus servicios. Matrículas importa sus módulos para consultar sus servicios compartidos. El controlador delega al servicio; las comprobaciones de existencia, estado activo, duplicados y cancelación están en `EnrollmentsService`. Los identificadores de matrícula son consecutivos y no se reutilizan al cancelar.

El DTO de creación exige `studentId` y `courseId` numéricos, enteros positivos seguros. Los filtros opcionales se convierten a números y validan mediante un DTO. `EnrollmentIdPipe` transforma y valida identificadores de ruta. Los campos desconocidos se rechazan con 400.

## Endpoints

| Método | Ruta | Función / respuesta exitosa |
|---|---|---|
| GET | `/courses?level=beginner` | Lista cursos, filtro opcional por nivel; 200 |
| GET | `/courses/:id` | Consulta un curso; 200 |
| POST | `/courses` | Crea un curso; 201 |
| PATCH | `/courses/:id` | Modifica un curso; 200 |
| DELETE | `/courses/:id` | Elimina un curso; 200 |
| GET | `/students` | Lista; filtros combinables `career`, `semester`, `isActive`; 200 |
| GET | `/students/:id` | Consulta un estudiante; 200 |
| POST | `/students` | Crea un estudiante; 201 |
| PATCH | `/students/:id` | Modifica un estudiante; 200 |
| PATCH | `/students/:id/status` | Modifica `isActive`; 200 |
| DELETE | `/students/:id` | Elimina un estudiante activo; 204 |
| POST | `/enrollments` | Registra una matrícula; 201 |
| GET | `/enrollments` | Lista; filtros combinables `studentId` y `courseId`; 200 |
| GET | `/students/:studentId/enrollments` | Matrículas del estudiante; 200 |
| GET | `/courses/:courseId/enrollments` | Matrículas del curso; 200 |
| DELETE | `/enrollments/:id` | Cancela una matrícula; 204 sin body |

Una consulta anidada devuelve 404 si el estudiante o curso no existe, y `[]` si existe pero no tiene matrículas. Los filtros de `/enrollments` devuelven `[]` cuando no hay coincidencias. Ambos filtros se aplican con AND.

## Demostración en Postman

Ejecutar en orden con el servidor recién iniciado. Usar Body → raw → JSON y `Content-Type: application/json` para POST/PATCH. Si ya hay datos, adaptar los IDs a las respuestas reales.

### Preparar estudiantes y comprobar cursos

Primero crea el curso con `POST /courses` usando el siguiente título y nivel (sin enviar id). Usa el id devuelto en las solicitudes siguientes. Los IDs 1 y 2 de estos ejemplos son ilustrativos:

```json
{"id":1,"title":"NestJS Fundamentals","level":"beginner"}
```

`POST /students`:

```json
{"name":"Ana Perez","email":"ana@example.com","age":20,"career":"Software","semester":3,"isActive":true}
```

Respuesta 201:

```json
{"name":"Ana Perez","email":"ana@example.com","age":20,"career":"Software","semester":3,"isActive":true,"id":1}
```

Crear el estudiante inactivo con `POST /students`:

```json
{"name":"Luis Perez","email":"luis@example.com","age":21,"career":"Software","semester":3,"isActive":false}
```

Respuesta 201: el mismo objeto con `id: 2`.

### Matrícula válida

`POST /enrollments`:

```json
{"studentId":1,"courseId":1}
```

Respuesta 201:

```json
{"id":1,"studentId":1,"courseId":1}
```

### Matrícula duplicada

Repetir el POST anterior. Respuesta 409:

```json
{"message":"El estudiante ya está matriculado en este curso","error":"Conflict","statusCode":409}
```

### Estudiante inactivo

`POST /enrollments` con `{"studentId":2,"courseId":1}`. Respuesta 409:

```json
{"message":"No se puede matricular a un estudiante inactivo","error":"Conflict","statusCode":409}
```

### Identificador inexistente

`POST /enrollments` con `{"studentId":999,"courseId":1}`. Respuesta 404:

```json
{"message":"No existe el estudiante 999","error":"Not Found","statusCode":404}
```

`POST /enrollments` con `{"studentId":1,"courseId":999}`. Respuesta 404:

```json
{"message":"No existe el curso 999","error":"Not Found","statusCode":404}
```

### Filtros individuales y combinados

Crear otra matrícula: `POST /enrollments` con `{"studentId":1,"courseId":2}`. Respuesta 201: `{"id":2,"studentId":1,"courseId":2}`.

`GET /enrollments?studentId=1` y `GET /students/1/enrollments` → 200:

```json
[{"id":1,"studentId":1,"courseId":1},{"id":2,"studentId":1,"courseId":2}]
```

`GET /enrollments?courseId=1` y `GET /courses/1/enrollments` → 200:

```json
[{"id":1,"studentId":1,"courseId":1}]
```

`GET /enrollments?studentId=1&courseId=2` → 200:

```json
[{"id":2,"studentId":1,"courseId":2}]
```

`GET /enrollments?studentId=2&courseId=2` → 200: `[]`.

### Cancelación

`DELETE /enrollments/1` → 204 sin contenido.

`GET /enrollments` → 200:

```json
[{"id":2,"studentId":1,"courseId":2}]
```

Repetir `DELETE /enrollments/1` → 404:

```json
{"message":"No existe la matrícula 1","error":"Not Found","statusCode":404}
```

Se permite volver a matricular a Ana en el curso 1; la nueva matrícula tendrá ID 3.

### Validación de entradas

| Solicitud | Respuesta |
|---|---|
| POST `/enrollments` con `{}` | 400: faltan los dos identificadores |
| POST `/enrollments` con `{"studentId":"1","courseId":1}` | 400: studentId debe ser entero numérico |
| POST `/enrollments` con `{"studentId":1,"courseId":1,"id":7}` | 400: propiedad id no permitida |
| GET `/enrollments?studentId=0` | 400: identificador fuera de rango |
| GET `/enrollments?studentId=1&studentId=2` | 400: filtro repetido |
| GET `/enrollments?otro=1` | 400: propiedad no permitida |
| DELETE `/enrollments/abc` | 400: Pipe rechaza el identificador |

## Pruebas reproducibles

```powershell
npm run test:integration
npm run lint
npm test
npm run test:e2e
```

`test:integration` compila y ejecuta las pruebas HTTP de Cursos, Estudiantes y Matrículas con aplicaciones de prueba aisladas, sin alterar los datos del servidor usado en Postman. También se puede ejecutar `npm run test:enrollments` o `npm run test:students` por separado.

`test/enrollments.http.test.mjs` cubre: matrícula válida usando un curso creado por HTTP, duplicados, estudiante inactivo, estudiante y curso inexistentes, filtros individuales y combinados, rutas anidadas, cancelación, nueva matrícula después de cancelar, entradas inválidas y propiedades adicionales. La suite de Estudiantes conserva la evidencia de sus flujos previos.

## Evidencia de integración Git

Validación realizada el 21 de septiembre de 2026: compilación correcta, 15 pruebas HTTP aprobadas (7 de Matrículas y 8 de Estudiantes), 3 pruebas unitarias aprobadas, 1 prueba e2e aprobada y `npm run lint` sin errores. Total: 19 pruebas aprobadas, 0 fallidas.

La rama `Trabajo_practico_semana_3` se incorporó desde `main` mediante un merge explícito. Se conservó además el merge previamente existente en `origin/main`.

```powershell
git log --oneline --graph --all -12
git show --no-patch --format=fuller 91d5c26
```

El commit `91d5c26` registra el merge de Cursos y Estudiantes. Los commits posteriores contienen Matrículas y sus evidencias. Para la demostración, ejecutar los casos anteriores y mostrar sus respuestas en Postman junto al historial Git.

Más documentación de la práctica previa: [SEMANA-3.md](SEMANA-3.md).

Validación de sesión 8 (29 de septiembre de 2026): build y lint correctos; 16 pruebas HTTP, 3 unitarias y 1 e2e aprobadas. La conexión real a PostgreSQL y la persistencia al reabrir la aplicación quedaron verificadas.
