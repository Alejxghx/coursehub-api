# CourseHub API hasta la semana 11

## CourseHub API hasta la semana 11

Esta guía explica la implementación de CourseHub API desde las relaciones persistentes de la semana 5 hasta la arquitectura de la semana 11. Permite ubicar cada responsabilidad en sus carpetas y seguir una solicitud desde Postman hasta PostgreSQL.

La base ya incluía estudiantes, cursos, matrículas, configuración validada y JWT de las sesiones 9 a 18. En esta actualización se añadieron roles, propiedad de cursos, CORS, limitación del login, componentes globales y un caso de uso independiente de HTTP y TypeORM.

- **5 · 9 y 10**: Estudiantes y matrículas persistentes; correo y pareja estudiante-curso únicos.
- **6 · 11 y 12**: Filtros, paginación, orden permitido, búsqueda y consultas relacionadas.
- **7 · 13 y 14**: Variables validadas y configuración de TypeORM por ambiente.
- **8 · 15 y 16**: Registro con bcrypt y comprobación segura de credenciales.
- **9 · 17 y 18**: Emisión de JWT y rutas con verificación Bearer.
- **10 · 19 y 20**: Rol actual, propiedad, CORS, cinco logins por minuto y requisito HTTPS.
- **11 · 21 y 22**: Logs seguros, errores uniformes, tiempos y actualización por caso de uso.

### Cómo estudiar esta guía

Empieza por el mapa de carpetas; revisa luego cada semana y los inventarios de archivos. Al final están los comandos de inicio, la matriz de autorización, la colección de Postman y las comprobaciones ejecutadas. Los ejemplos de tokens se muestran con referencias de variables, nunca con credenciales completas.

Estado verificado el 15 de noviembre de 2026: 92 pruebas correctas, con PostgreSQL temporal y esquemas aislados. Las cuentas y datos usados para comprobar la entrega no sustituyen la configuración de tu base local.

## 1 Mapa de carpetas del proyecto

```text
coursehub-api/
  src/
    main.ts                 Inicio HTTP
    app.module.ts           Conecta los módulos
    auth/                   Login, JWT y permisos
      decorators/           Roles y usuario actual
      dto/                  Entradas de registro y login
      guards/               Identidad y roles
      strategies/           Verificación JWT
      types/                Payload e identidad segura
    users/                  Cuentas y rol controlado
      entities/             Tabla users
    courses/                Cursos y propiedad
      application/          Caso de uso de actualización
      domain/               Modelo, contrato y errores
      infrastructure/       Adaptador TypeORM
      dto/                  Entradas y consultas
      entities/             Tabla courses
    students/               Estudiantes persistentes
      dto/  entities/  pipes/
    enrollments/            Matrículas y relaciones
      dto/  entities/  pipes/
    common/                 Reglas transversales
      middleware/  filters/  interceptors/
    config/                 Ambiente, base y CORS
  test/                     Pruebas HTTP e integración
  postman/                  Colecciones para usar la API
  scripts/                  Administración local de roles
  migrations/               Cambio SQL de esquema existente
  docs/                     Guías editables de estudio
  output/                   Documentos y evidencia sin secretos
  dist/                     JavaScript generado al compilar
  node_modules/             Dependencias instaladas
```

src contiene el código que se mantiene. dist se regenera con npm run build: no se programa dentro de esa carpeta. node_modules se reconstruye con npm ci y no se sube al repositorio. Un .env real es configuración privada del equipo; .env.example solo documenta los nombres y marcadores.

## 2 Semana 5 Estudiantes persistentes

La sesión 9 sustituye el almacenamiento temporal de estudiantes por un repositorio TypeORM. PostgreSQL genera el identificador y mantiene las filas tras reiniciar Nest. El controlador conserva sus rutas; el cambio de almacenamiento ocurre en el servicio y la entidad.

### Responsabilidades del módulo students

students.controller.ts recibe cuerpos, consultas e identificadores. Los DTOs validan nombre, correo, edad, carrera, semestre y estado. StudentIdPipe exige un identificador decimal positivo antes de convertirlo. students.service.ts busca, filtra y decide si una operación puede ejecutarse.

entities/student.entity.ts describe la tabla students. email tiene unicidad en PostgreSQL: una comprobación previa mejora el mensaje, mientras la restricción impide duplicados ante solicitudes simultáneas. Los errores de unicidad se traducen a 409.

```text
POST /students
{
  "name": "Ana Torres",
  "email": "ana.torres@example.edu",
  "age": 20,
  "career": "Software",
  "semester": 4,
  "isActive": true
}
```

La respuesta de creación es 201. Después de reiniciar, GET /students/:id debe conservar el registro. Repetir el correo produce 409; usar un identificador inexistente produce 404. Un estudiante inactivo no puede eliminarse y los filtros career, semester e isActive siguen funcionando, incluido el valor false.

### Diferencia entre DTO y entidad

El DTO decide qué JSON puede entrar. La entidad decide qué columnas existen. El servicio aplica reglas de negocio, por ejemplo correo disponible y prohibición de eliminar inactivos. Ninguna de esas tres piezas sustituye a las demás.

## 3 Semana 5 Matrículas y relaciones

La sesión 10 añade Enrollment como relación persistente entre un estudiante y un curso. La tabla enrollments contiene la referencia a ambos; los listados pueden devolver sus datos relacionados sin duplicar la información principal.

- **El estudiante y el curso existen**: EnrollmentsService y claves foráneas en PostgreSQL.
- **El estudiante está activo**: EnrollmentsService antes de guardar.
- **No se repite la misma pareja**: Comprobación del servicio y restricción única compuesta.
- **No borrar un recurso con matrículas**: Integridad referencial y conversión del conflicto a 409.
- **Cancelar una matrícula**: DELETE /enrollments/:id; elimina la relación, no el estudiante ni el curso.

```text
POST /enrollments
{ "studentId": 1, "courseId": 1 }

GET /enrollments?studentId=1&courseId=1
GET /students/1/enrollments
GET /courses/1/enrollments
DELETE /enrollments/1
```

Una creación correcta responde 201; un duplicado responde 409; un estudiante inactivo produce 400; la ausencia de un recurso produce 404. La cancelación correcta responde 204 sin cuerpo. Los errores PostgreSQL 23505 y 23503 se interpretan sin publicar consultas SQL.

### Separación entre cuenta y estudiante

User representa una cuenta que inicia sesión. Student representa el registro académico. Son entidades independientes y no se estableció una relación automática entre ambas. El rol student de una cuenta tampoco crea por sí mismo una fila en students.

## 4 Semana 6 Consultas de datos

La sesión 11 evita devolver todos los cursos en una sola consulta. CoursesQueryDto valida filtros, página, límite y orden; el servicio usa findAndCount para recuperar filas y total. El orden se elige de una lista permitida, sin aceptar nombres de columna arbitrarios.

```text
GET /courses?level=beginner&page=1&limit=10

{
  "items": ["cursos de esta página"],
  "meta": {
    "total": 25, "page": 1,
    "limit": 10, "totalPages": 3
  }
}
```

La forma anterior es un ejemplo de contrato, no una captura de resultados. skip calcula cuántas filas omitir y take cuántas recuperar. El orden estable incorpora el id para evitar cambios arbitrarios entre filas con el mismo valor principal.

### Búsqueda relacionada de la sesión 12

EnrollmentsQueryDto admite search, studentId, courseId, activeOnly, page y limit. EnrollmentsService construye JOIN con estudiante y curso, agrega condiciones solo cuando llegan filtros y usa parámetros para los valores del cliente.

```text
GET /enrollments?search=Nest&page=1&limit=10
GET /enrollments?studentId=1&activeOnly=true

queryBuilder.andWhere(
  '(student.name ILIKE :search OR course.title ILIKE :search)',
  { search: `%${search}%` },
);
```

El texto de búsqueda es un dato asociado a :search; no se concatena como estructura SQL. La respuesta conserva items y meta. activeOnly es una cadena booleana validada; false no se convierte accidentalmente en true.

## 5 Semana 7 Configuración por ambiente

Las sesiones 13 y 14 sacan la configuración del código. ConfigModule ejecuta validateEnvironment antes de iniciar la aplicación. Joi valida variables, convierte puertos y rechaza una configuración incompleta sin mostrar los valores secretos.

- **src/config/environment.ts**: Esquema de NODE_ENV, PORT, DATABASE_*, JWT_* y CORS_ORIGINS.
- **src/config/database.config.ts**: Construye opciones TypeORM desde ConfigService.
- **src/config/http.config.ts**: Activa CORS con orígenes explícitos y cabeceras permitidas.
- **.env.example**: Plantilla compartida sin el secreto real del equipo.
- **.gitignore**: Excluye .env, dependencias, dist y otros archivos generados.

```text
NODE_ENV=development
PORT=3000
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=coursehub
DATABASE_USER=postgres
DATABASE_PASSWORD=change_me
JWT_SECRET=replace-with-a-long-random-local-secret
JWT_EXPIRES_IN=15m
CORS_ORIGINS=http://localhost:3001
```

El secreto del ejemplo es un marcador rechazado por la validación. Debe reemplazarse localmente por uno aleatorio de al menos 32 caracteres. El valor real no aparece en esta guía ni se publica en GitHub.

synchronize es true únicamente con NODE_ENV=development. En test y production es false y el esquema debe prepararse explícitamente. autoLoadEntities incorpora las entidades registradas en cada módulo. En producción se exige un CORS_ORIGINS explícito y una contraseña de base no vacía.

## 6 Semana 8 Registro y credenciales

Las sesiones 15 y 16 incorporan una cuenta User independiente de Student. UsersModule administra su persistencia. AuthModule coordina el registro y el login, mientras los controladores fijan rutas, DTOs y estados HTTP.

- **auth/dto/register.dto.ts**: Correo válido normalizado y contraseña de 8 a 72 caracteres, máximo 72 bytes. No admite role.
- **auth/dto/login.dto.ts**: Valida las credenciales; conserva espacios y mayúsculas de la contraseña.
- **auth/auth.service.ts**: Calcula bcrypt con costo 12 y compara con bcrypt.compare.
- **users/entities/user.entity.ts**: Tabla users con id, email único, role, hash y createdAt.
- **users/users.service.ts**: Crea cuentas y selecciona el hash solo cuando se necesita para login.

La contraseña nunca se guarda en texto. password_hash usa select: false, así que las consultas normales no recuperan el hash. El registro devuelve solo id, email y createdAt; el rol de base es student por defecto. Un campo role agregado al cuerpo se rechaza con 400.

```text
POST /auth/register
{
  "email": "cuenta@example.com",
  "password": {{practicePasswordJson}}
}

POST /auth/login
# Mismo correo y contraseña privada de práctica.
```

El registro nuevo devuelve 201 y el correo repetido 409. El login conserva 401 con el mensaje genérico Invalid credentials para una contraseña incorrecta y para un correo inexistente. Así no distingue públicamente cuál credencial falló. Un DTO inválido produce 400 antes de consultar o persistir datos.

## 7 Semana 9 JWT y rutas protegidas

La sesión 17 cambia el login: primero valida las credenciales y luego firma un payload explícito. JwtModule.registerAsync obtiene JWT_SECRET y JWT_EXPIRES_IN de ConfigService y utiliza HS256. La duración predeterminada es 15m, es decir 900 segundos.

```text
{
  "accessToken": "[OMITIDO: credencial]",
  "user": { "id": 1, "email": "cuenta@example.com",
            "createdAt": "fecha de creación" }
}

// Claims propios: la biblioteca añade iat y exp.
const payload = { sub: user.id, email: user.email };
```

El JWT tiene header, payload y firma. El payload puede leerse: estar firmado no implica estar cifrado. No contiene contraseña, hash ni secreto de firma. Decodificar solo lee; verificar comprueba firma y vencimiento.

### Verificación de la sesión 18 y evolución actual

JwtStrategy extrae Authorization: Bearer, exige HS256, valida exp y comprueba sub y email. JwtAuthGuard aplica esa estrategia antes del controlador. GET /auth/me devuelve una identidad segura.

En la actualización de semana 10 la estrategia también busca la cuenta por id y recupera su rol actual. Esto evita confiar en roles enviados por el cliente o conservar privilegios antiguos. Si la cuenta desaparece, el token recibe 401. El payload sigue mínimo; el rol se consulta en PostgreSQL.

```text
GET /auth/me
Authorization: Bearer {{accessToken}}

{ "id": 1, "email": "cuenta@example.com", "role": "student" }
```

Tokens ausentes, alterados, mal formados, vencidos, de otro secreto o de otro algoritmo reciben 401. La respuesta nunca devuelve el token recibido ni el hash de la cuenta.

## 8 Semana 10 Roles y propiedad de cursos

La sesión 19 añade UserRole con tres valores cerrados: admin, teacher y student. El registro siempre comienza con el menor privilegio. @Roles declara la política y RolesGuard la evalúa después de JwtAuthGuard. @CurrentUser entrega la identidad segura al controlador.

- **POST /courses**: Admin o teacher. El propietario se toma del usuario autenticado.
- **PATCH /courses/:id**: Admin puede editar cualquiera; teacher solo el propio.
- **DELETE /courses/:id**: Exclusivamente admin.
- **GET /auth/me**: Cualquier cuenta con JWT válido.
- **Registro, login y lecturas de cursos**: Públicas; el login tiene límite de solicitudes.
- **Estudiantes y matrículas**: Conservan sus rutas públicas en la política acotada de esta práctica.

### La misma actualización con cinco identidades

- **Sin token**: 401; no hay identidad válida.
- **Cuenta student**: 403; no tiene el permiso.
- **Teacher de otro curso**: 403; no es propietario.
- **Teacher propietario**: 200; aplica la actualización.
- **Admin**: 200; puede administrar cualquier curso.

Course incorpora createdByUserId, asociado a users mediante clave foránea. CreateCourseDto y UpdateCourseDto no admiten ese campo: el cliente no puede atribuirse ni cambiar la propiedad. Cursos antiguos pueden tener propietario NULL; solo admin los modifica hasta una asignación local controlada.

## 9 Semana 10 Seguridad de acceso

La sesión 20 añade defensa en profundidad: JWT identifica, los roles autorizan, los DTOs validan y CORS controla la lectura desde navegadores. Ninguna capa sustituye a las otras.

### CORS con orígenes documentados

CORS_ORIGINS contiene orígenes exactos separados por comas, por ejemplo http://localhost:3001 en desarrollo. Se permiten Content-Type y Authorization; se exponen X-Request-Id y X-Response-Time. No se utiliza el comodín *. Un origen ajeno no recibe Access-Control-Allow-Origin.

Postman no aplica la política de un navegador. Puede recibir 200 aun desde un Origin ajeno; la comprobación consiste en revisar que falte la cabecera de permiso. Para ver el bloqueo de lectura completo se utiliza un navegador.

### Cinco intentos de login por minuto

ThrottlerGuard y @Throttle limitan POST /auth/login a cinco intentos por cliente en una ventana de 60 segundos. El sexto devuelve 429 y Retry-After. Se cuentan intentos válidos e inválidos. Registro y otras rutas no tienen un límite global en esta implementación.

### Administración local y actualización de la base

```text
npm run user:role -- teacher11@example.com teacher
npm run user:role -- admin11@example.com admin

# Archivo para un esquema existente sin synchronize:
migrations/semana-10-roles-y-propiedad.sql
```

La CLI exige acceso local a PostgreSQL y solo admite roles conocidos. No existe una ruta pública para promover cuentas. El script SQL añade el rol por defecto y la propiedad nullable sin borrar cursos previos; se comprobó que puede repetirse.

Producción requiere HTTPS/TLS mediante proxy o plataforma. El desarrollo en localhost puede usar HTTP. Si se despliega detrás de un proxy, su configuración de confianza y límites debe revisarse; el rate limit actual usa memoria por proceso y no es una solución distribuida.

## 10 Semana 11 Componentes transversales

La sesión 21 centraliza responsabilidades que antes se repetirían en los controladores. AppModule registra middleware, filtro e interceptor una sola vez. Los controladores conservan DTOs y los pipes adecuados a sus identificadores.

- **common/middleware/**: RequestLoggerMiddleware crea X-Request-Id y registra método, plantilla de ruta, estado y duración. No registra headers, cuerpos, cookies ni consultas.
- **auth/guards/**: Decide si la solicitud continúa según identidad y rol.
- **students/pipes/ y enrollments/pipes/**: Validan el formato decimal del id; cursos usa ParseIntPipe.
- **common/filters/**: HttpErrorFilter traduce errores HTTP y de dominio y oculta detalles inesperados con 500 genérico.
- **common/interceptors/**: TimingInterceptor añade X-Response-Time y observa éxito/error sin cambiar el resultado ni ocultar excepciones.

```text
{
  "statusCode": 403,
  "message": "You cannot modify this course",
  "path": "/courses/1",
  "timestamp": "fecha ISO de la solicitud",
  "requestId": "identificador de correlación"
}
```

El campo error se conserva cuando lo proporciona una excepción HTTP. path omite el query string. Los 500 siempre responden Internal server error; no se publican stack, SQL ni variables del entorno. El identificador coincide con X-Request-Id para poder correlacionar la respuesta y el registro operativo.

Orden real: middleware, guards, entrada del interceptor, pipes, controlador y caso de uso; después el interceptor observa la respuesta. Si hay una excepción, el filtro la traduce. El middleware mide también errores rechazados antes del controlador.

## 11 Semana 11 Caso de uso y adaptador

La sesión 22 refactoriza únicamente la actualización de cursos. La regla ya no necesita HTTP, DTOs decorados ni TypeORM para ejecutarse o probarse. El resto del sistema conserva servicios y repositorios directos donde todavía resultan adecuados.

```text
CoursesController
    -> UpdateCourseUseCase
        -> CourseRepository (puerto pequeño)
            -> TypeOrmCourseRepository
                -> Repository<Course> -> PostgreSQL
```

- **courses/domain/**: CourseRecord, UpdateCourseChanges, errores propios y el contrato findById/save.
- **courses/application/**: Busca el curso, comprueba admin o teacher propietario y prepara los campos editables.
- **courses/infrastructure/**: Traduce el contrato a las operaciones TypeORM.
- **courses/courses.module.ts**: Une el símbolo COURSE_REPOSITORY con el adaptador mediante provide/useClass y crea el caso de uso por fábrica.

### Regla que ejecuta el caso de uso

```text
const course = await this.courses.findById(id);
if (!course) throw new CourseNotFoundError();
const admin = actor.role === UserRole.ADMIN;
const owner = actor.role === UserRole.TEACHER
  && course.createdByUserId === actor.id;
if (!admin && !owner) throw new CoursePermissionError();
return this.courses.save({
  ...course,
  title: changes.title ?? course.title,
  level: changes.level ?? course.level,
});
```

Si cambia el almacenamiento, se reemplaza el adaptador. Si cambia quién puede editar, se cambia el caso de uso. Los errores de dominio se traducen a 404 o 403 en el filtro HTTP; el dominio no conoce códigos HTTP. La prueba unitaria usa un repositorio en memoria sin levantar Nest.

## 12 Inventario de archivos de cursos

Las siguientes rutas se encuentran dentro de src/courses. El módulo combina el código previo con la refactorización gradual de actualización.

- **courses.controller.ts**: Rutas GET, POST, PATCH y DELETE; aplica guards, roles, parámetros y DTOs.
- **courses.service.ts**: Listados paginados, lectura individual, creación con propietario y eliminación exclusiva de admin. Ya no contiene update.
- **courses.module.ts**: Configura entidad, AuthModule, servicio, puerto, adaptador y caso de uso.
- **entities/course.entity.ts**: Tabla courses, propietario nullable y relación con matrículas.
- **dto/create-course.dto.ts**: Exige título no vacío y nivel permitido.
- **dto/update-course.dto.ts**: Permite actualizar los campos admitidos sin aceptar propietario.
- **dto/courses-query.dto.ts**: Filtro level, paginación y lista permitida de orden.
- **domain/course.ts**: Modelo plano del curso y tipo de cambios editables.
- **domain/course-repository.port.ts**: Contrato de dos métodos y símbolo usado por la inyección.
- **domain/course.errors.ts**: Errores de recurso inexistente y permiso de actualización.
- **application/update-course.use-case.ts**: Regla independiente para actualizar un curso con autorización de propiedad.
- **infrastructure/typeorm-course.repository.ts**: Implementa findById/save contra PostgreSQL con TypeORM.
- **application/update-course.use-case.spec.ts**: Seis pruebas de regla y propiedad sin HTTP ni base.
- **courses.controller.spec.ts y courses.service.spec.ts**: Pruebas básicas de construcción de las clases existentes.

Una carpeta adicional solo tiene sentido cuando separa una responsabilidad. En este caso application y domain permiten probar la decisión de propiedad sin que la prueba dependa del framework o de la base de datos.

## 13 Inventario de estudiantes y matrículas

### Dentro de src/students

- **students.module.ts**: Entrega el repositorio Student al módulo y registra controlador/servicio.
- **students.controller.ts**: CRUD, filtros y cambio de estado.
- **students.service.ts**: Persistencia, correo único, existencia y reglas sobre inactivos.
- **entities/student.entity.ts**: Columnas académicas y email único de la tabla students.
- **dto/create-student.dto.ts**: Contrato para crear y rangos de los campos.
- **dto/update-student.dto.ts y update-student-status.dto.ts**: Edición parcial y ruta que solo admite isActive.
- **dto/filter-students.dto.ts**: Filtros opcionales; interpreta true y false correctamente.
- **pipes/student-id.pipe.ts y student.ts**: Valida ids; student.ts solo reexporta el tipo por compatibilidad.

### Dentro de src/enrollments

- **enrollments.module.ts**: Registra repositorios de matrícula, estudiante y curso.
- **enrollments.controller.ts**: Creación, listado, búsquedas por relación y cancelación.
- **enrollments.service.ts**: Reglas de matrícula, JOIN, filtros, paginación y cancelación.
- **entities/enrollment.entity.ts**: Relaciones persistentes y unicidad de estudiante-curso.
- **dto/create-enrollment.dto.ts**: Valida identificadores del cuerpo de creación.
- **dto/enrollments-query.dto.ts**: Contrato actual de búsqueda, relaciones, estado y página.
- **dto/filter-enrollments.dto.ts**: DTO de filtros anterior; el listado actual usa EnrollmentsQueryDto.
- **pipes/enrollment-id.pipe.ts**: Valida los ids de matrícula, estudiante o curso en las rutas.

## 14 Inventario de autenticación y cuentas

Las rutas de esta página se encuentran dentro de src. Auth decide cómo se demuestra y autoriza la identidad; Users administra las cuentas persistentes.

- **auth/auth.controller.ts**: Register, login limitado y perfil me protegido.
- **auth/auth.service.ts**: bcrypt, validación de credenciales y emisión del JWT mínimo.
- **auth/auth.module.ts**: Configura JWT, Passport y Throttler; exporta guards compartidos.
- **auth/dto/register.dto.ts y login.dto.ts**: Valida credenciales sin permitir role ni passwordHash del cliente.
- **auth/strategies/jwt.strategy.ts**: Verifica Bearer y recupera cuenta/rol vigentes sin seleccionar el hash.
- **auth/guards/jwt-auth.guard.ts**: Solicita la estrategia jwt para una ruta.
- **auth/guards/roles.guard.ts**: Lee los roles permitidos del método o controlador.
- **auth/decorators/roles.decorator.ts**: Declara roles como metadata, no concede permisos por sí solo.
- **auth/decorators/current-user.decorator.ts**: Extrae req.user de forma controlada.
- **auth/types/jwt-payload.type.ts**: Tipos del payload y de la identidad con role.
- **users/entities/user.entity.ts**: Cuenta, email único, rol enum por defecto student y hash oculto.
- **users/user-role.enum.ts**: Valores admin, teacher y student.
- **users/users.service.ts**: Búsqueda por id/correo, lectura explícita del hash y creación segura.
- **users/users.module.ts**: Configura la entidad y exporta UsersService.

Modificar un rol exige la CLI local y credenciales de base válidas. La estrategia consulta la base en cada ruta protegida, así que retirar un rol tiene efecto también sobre tokens emitidos anteriormente. Los tokens no se convierten en permisos por incluir un claim adicional inventado.

## 15 Archivos de arranque y soporte

- **src/main.ts**: Crea Nest, activa CORS, instala ValidationPipe global y escucha PORT.
- **src/app.module.ts**: Conecta módulos, configuración y TypeORM; registra filtro, interceptor y middleware globales.
- **src/app.controller.ts y app.service.ts**: Respuesta básica de disponibilidad en la raíz de la API.
- **src/welcome.controller.ts y welcome.service.ts**: Mensaje de bienvenida de las prácticas iniciales.
- **src/config/**: Esquema de ambiente, conexión PostgreSQL y política CORS.
- **src/common/postgres-error.ts**: Identifica códigos de errores TypeORM/PostgreSQL que los servicios traducen.
- **test/**: Pruebas HTTP, JWT, persistencia, seguridad y utilidades de base temporal.
- **postman/**: Colecciones por sesiones; semana-11 contiene la política vigente.
- **scripts/set-user-role.mjs**: Asigna un rol válido a una cuenta ya registrada, con SQL parametrizado.
- **migrations/semana-10-roles-y-propiedad.sql**: Actualiza tablas anteriores sin inventar propietarios ni borrar datos.
- **docs/ y output/**: Guías editables, Word y resultados de comprobación sin secretos.
- **package.json y package-lock.json**: Dependencias, comandos y versiones resueltas reproducibles.
- **tsconfig*.json y nest-cli.json**: Compilación TypeScript y configuración de Nest CLI.
- **vitest.config*.ts y oxlint.json**: Selección de pruebas unitarias/e2e y revisión estática.

Los documentos y colecciones de sesiones anteriores describen su contrato histórico. Para la política actual de roles usa docs/semana-11.md y postman/semana-11.postman_collection.json. No copies resultados antiguos como si fueran la verificación de esta actualización.

## 16 Comprobaciones ejecutadas

- **Pruebas unitarias**: 39 correctas, incluidas seis del caso de uso independiente.
- **HTTP e integración PostgreSQL**: 52 correctas, incluidas autorización, CORS, logs y rate limit.
- **Arranque e2e**: 1 correcta.
- **Total**: 92 correctas.

Las pruebas usan PostgreSQL 17 temporal con esquemas únicos que se eliminan al terminar. Comprueban persistencia después de reiniciar Nest, unicidad, claves foráneas y las reglas existentes. La compilación y la revisión estática también terminaron correctamente.

### Casos nuevos verificados

Se ejecutó PATCH con cinco identidades: 401 sin token, 403 para estudiante, 403 para docente ajeno, 200 para propietario y 200 para admin. También se comprobó que un 403 no modifica el curso ni permite borrarlo.

El registro rechaza role=admin y una cuenta normal queda como student. Un propietario inyectado se rechaza. El perfil usa el rol actual y una cuenta eliminada recibe 401. Los casos 400, 403, 404, 429 y un 500 inesperado conservan el formato de error y no muestran trazas.

CORS permite la cabecera del origen configurado y no la concede a un origen ajeno. El middleware no incluyó el valor sensible enviado en el query ni tokens en sus registros. Se verificaron X-Request-Id y X-Response-Time. El sexto login dentro de la ventana obtuvo 429 y Retry-After.

### Cómo repetir las pruebas

```text
npm run build
npm run lint
npm test
npm run test:auth
npm run test:jwt
# Con PostgreSQL y variables configuradas:
npm run test:integration
npm run test:e2e
npm run test:week11
```

Las suites aisladas de credenciales omiten el throttler para poder recorrer su matriz extensa. La suite week11 prueba el guard de tasa real sin desactivarlo. El 500 se provoca solo en un controlador de prueba; no se añadió una ruta pública de fallo a la API.

## 17 Preparar y demostrar la entrega

### Iniciar en tu equipo

```text
npm ci
# Solo si no tienes un .env preparado:
cp .env.example .env
# Configura PostgreSQL, secreto JWT y CORS locales.
npm run start:dev
```

No sobrescribas un .env ya configurado. Crea la base CourseHub y revisa host, puerto, usuario y contraseña. En development TypeORM sincroniza el esquema. Para un esquema existente en producción, revisa y aplica la migración SQL con respaldo; nunca actives synchronize como estrategia de producción.

### Preparar cuentas y roles de práctica

Importa la colección semana-11 y define practicePassword en un entorno privado de Postman. Ejecuta la carpeta 01 para registrar las cuatro cuentas. Después asigna roles localmente:

```text
npm run user:role -- student11@example.com student
npm run user:role -- teacher11@example.com teacher
npm run user:role -- teacher-other11@example.com teacher
npm run user:role -- admin11@example.com admin
```

Ejecuta la carpeta 02 para obtener cuatro tokens. No publiques sus valores ni exportes el entorno. En Visualize puedes mostrar el usuario sin el token. Cada login consume un intento; espera la ventana antes de repetir toda la carpeta.

### Demostración de la semana 11 en ocho minutos

Minutos 0 a 2: crea el curso como docente y muestra la actualización correcta. Minutos 2 a 4: provoca id inválido, recurso ausente y modificación por docente ajeno. Minutos 4 a 6: señala el controlador, el caso de uso y el adaptador. Minutos 6 a 8: muestra el error uniforme, el id de petición y el registro sin secretos.

En CORS recuerda que Postman puede leer la respuesta: comprueba las cabeceras y explica la diferencia con el navegador. Para demostrar 429 usa intentos controlados, sin cambiar el límite de cinco por minuto.

## 18 Fuentes y límites del alcance

El contenido combina el temario público consultado con el código y las pruebas de este repositorio. La sesión 9 indicada por el usuario es el punto de inicio; se revisaron los objetivos y entregables hasta la semana 11.

### Páginas del curso

https://epanchanaf.github.io/nestjs-course/semana-05/sesion-09

https://epanchanaf.github.io/nestjs-course/semana-05/sesion-10

https://epanchanaf.github.io/nestjs-course/semana-06/sesion-11

https://epanchanaf.github.io/nestjs-course/semana-06/sesion-12

https://epanchanaf.github.io/nestjs-course/semana-07/sesion-13

https://epanchanaf.github.io/nestjs-course/semana-07/sesion-14

https://epanchanaf.github.io/nestjs-course/semana-08/sesion-15

https://epanchanaf.github.io/nestjs-course/semana-08/sesion-16

https://epanchanaf.github.io/nestjs-course/semana-09/sesion-17

https://epanchanaf.github.io/nestjs-course/semana-09/sesion-18

https://epanchanaf.github.io/nestjs-course/semana-10/sesion-19

https://epanchanaf.github.io/nestjs-course/semana-10/sesion-20

https://epanchanaf.github.io/nestjs-course/semana-11/sesion-21

https://epanchanaf.github.io/nestjs-course/semana-11/sesion-22

### Qué no se afirma en esta entrega

No se implementaron OAuth, refresh tokens, MFA, revocación distribuida ni roles de semanas posteriores. El tratamiento global no convierte todas las respuestas correctas en un envoltorio nuevo: se conservan los contratos de éxito. La refactorización en capas se limita a actualizar cursos; estudiantes y matrículas conservan su arquitectura existente.

La política de negocio protegida se concentra en cursos. Los permisos de estudiantes y matrículas no se ampliaron sin un requisito explícito. HTTPS es un requisito de despliegue documentado; no se instaló un certificado ni se publicó un servidor externo.

Repositorio: https://github.com/Alejxghx/coursehub-api. La configuración privada sigue fuera de GitHub. La evidencia de la actualización se almacena en output/semana-11-verificacion.json y las instrucciones editables en docs/semana-11.md.
