# CourseHub API — Sesiones 9 y 10

Cursos, estudiantes y matrículas persistentes en PostgreSQL con NestJS y TypeORM.

## Ejecutar

Desde `aplicaciones-servidor-web/coursehub-api`:

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
`PORT` (3000 por defecto). Nunca subas `.env` con credenciales.

`autoLoadEntities: true` incorpora las entidades registradas mediante `forFeature`.
`synchronize: true` crea/actualiza las tablas para esta práctica de desarrollo;
en producción se utilizan migraciones. No se precargan datos de ejemplo en la API.

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

## Endpoints

| Método | Ruta | Respuesta |
|---|---|---|
| POST | /courses | 201 |
| GET | /courses?level=beginner | 200 |
| GET / PATCH | /courses/:id | 200 |
| DELETE | /courses/:id | 200, curso eliminado |
| POST | /students | 201 |
| GET | /students?career=Software&semester=6&isActive=true | 200 |
| GET / PATCH | /students/:id | 200 |
| PATCH | /students/:id/status | 200 |
| DELETE | /students/:id | 204 |
| POST | /enrollments | 201 |
| GET | /enrollments?studentId=3&courseId=5 | 200 |
| GET | /students/:studentId/enrollments | 200 |
| GET | /courses/:courseId/enrollments | 200 |
| DELETE | /enrollments/:id | 204 |

Los filtros son opcionales y combinables con AND. Las rutas anidadas validan que
exista el recurso padre. Los listados sin coincidencias devuelven `[]`.
No existe GET /enrollments/:id: para encontrar la matrícula utiliza sus filtros.

Cursos conserva únicamente los niveles beginner, intermediate y advanced en los DTOs.
PATCH conserva los campos omitidos. Un id de curso no numérico devuelve 400.

## Evidencias para entregar en Postman

Importa [la colección de sesiones 9 y 10](postman/sesiones-9-10.postman_collection.json).
Usa baseUrl = http://localhost:3000. Ejecútala manualmente en orden; no ejecutes toda
la colección de una vez, porque debes detener e iniciar la API entre los pasos 02 y 03.
La colección prepara correos distintos por ejecución y guarda los IDs de las respuestas.
Los cuerpos JSON de matrículas usan variables numéricas sin comillas.

1. Crear curso y estudiante activo: 201 en ambos.
2. Crear matrícula: 201; conservar su ID.
3. Detener con Ctrl+C, ejecutar nuevamente `npm run start:dev` y consultar la matrícula:
   200, mismo ID y objetos student/course. Capturar también la terminal del reinicio.
4. Repetir el POST de matrícula: 409.
5. Crear otro estudiante inactivo e intentar matricularlo: 400.
6. Filtrar por estudiante y por curso: 200, incluye la matrícula.
7. Cancelar: 204. Consultar la pareja: `[]`. Repetir DELETE: 404.

En cada captura muestra método, URL, body (cuando corresponda), código HTTP y respuesta.
La colección comprueba códigos, identidad de la matrícula y ausencia después de cancelar.
Estos datos de demostración permanecen en tu base; las pruebas automatizadas usan esquemas separados.

Para sesión 9 también muestra POST /students, PATCH /students/:id, reinicio, GET /students/:id,
filtros combinados y 409 al repetir el correo. Cambiar isActive a false y eliminar debe dar 409.

## Pruebas

```powershell
npm run test:integration
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
- [Práctica previa de semana 3](SEMANA-3.md)

## Verificación realizada — 5 de octubre de 2026

Compilación y lint correctos. Pasaron 17 pruebas HTTP de integración (incluida
persistencia y concurrencia), 3 unitarias y 1 e2e: 21 pruebas, 0 fallidas.
También se reprodujeron las 12 solicitudes de la colección de entrega contra una
aplicación aislada, comprobando sus variables, cuerpos y aserciones de respuesta.
La reproducción automatizada no sustituye las capturas de Postman y del reinicio
manual que se soliciten para subir la tarea.
