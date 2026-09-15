# Trabajo práctico — Semana 3: Gestión de estudiantes

## Ejecutar

Desde la carpeta `aplicaciones-servidor-web/coursehub-api`:

```powershell
npm run start:dev
```

La API estará en `http://localhost:3000` (o en el puerto definido por `PORT`). Las dependencias ya están instaladas; en otra computadora, ejecutar primero `npm ci`.

Los estudiantes se guardan en un arreglo en memoria. El listado inicia vacío y los datos se pierden al reiniciar el proceso. Los identificadores son enteros positivos autogenerados y no se reutilizan durante la ejecución.

## Rutas

| Método | Ruta | Resultado exitoso |
| --- | --- | --- |
| POST | `/students` | 201, estudiante registrado |
| GET | `/students` | 200, lista de estudiantes |
| GET | `/students/:id` | 200, estudiante encontrado |
| PATCH | `/students/:id` | 200, estudiante actualizado parcialmente |
| DELETE | `/students/:id` | 204, sin cuerpo |
| PATCH | `/students/:id/status` | 200, estudiante con estado actualizado |

### Registrar

Enviar JSON con los seis campos obligatorios; el servidor genera `id`:

```json
{
  "name": "Ana Perez",
  "email": "ana@example.com",
  "age": 20,
  "career": "Software",
  "semester": 3,
  "isActive": true
}
```

`name` y `career` deben contener texto no vacío. `email` debe ser válido y único, incluso al editar; se normaliza a minúsculas y se eliminan espacios exteriores. Como criterio adicional de validación, `age` debe ser un entero positivo. `semester` debe ser un entero de 1 a 10. `isActive` debe ser un booleano JSON (`true` o `false`, sin comillas).

### Modificar parcialmente

`PATCH /students/1`, por ejemplo:

```json
{ "semester": 4 }
```

Solo se cambian los campos enviados. Se rechazan `id`, propiedades desconocidas y valores `null`. Un objeto vacío conserva el estudiante sin cambios. El PATCH general admite los seis campos del estudiante; la ruta dedicada de estado admite exclusivamente `isActive`.

### Cambiar estado

`PATCH /students/1/status`:

```json
{ "isActive": false }
```

Un estudiante inactivo no puede eliminarse. Para eliminarlo, primero cambiar su estado a `true`.

### Filtros opcionales y combinables

```text
GET /students?career=Software
GET /students?semester=3
GET /students?isActive=false
GET /students?career=Software&semester=3&isActive=false
```

Los filtros se combinan con AND: el estudiante debe cumplir todos los criterios enviados. La carrera coincide exactamente, distinguiendo mayúsculas y minúsculas. Para carreras con espacios, usar la pestaña Params de Postman. `semester` se transforma a número; `isActive` acepta `true` o `false`. Los filtros vacíos, repetidos o inválidos se rechazan. Sin coincidencias se devuelve `[]`.

## Excepciones y validaciones

- **400 Bad Request:** datos inválidos, campos desconocidos, modificación de `id`, filtros incorrectos o identificador que no sea un entero positivo seguro.
- **404 Not Found:** no existe el estudiante al consultar, editar, cambiar estado o eliminar.
- **409 Conflict:** correo ya utilizado por otro estudiante o intento de eliminar un estudiante inactivo.

Primero se validan los datos recibidos. Para peticiones válidas, el servicio comprueba la existencia antes de operar sobre un estudiante.

## Organización para explicar en clase

- `src/students/students.module.ts`: registra el controlador y el servicio mediante el sistema de módulos e inyección de dependencias de NestJS.
- `src/students/students.controller.ts`: define rutas, recibe DTOs y delega al servicio. No contiene reglas de negocio.
- `src/students/students.service.ts`: almacenamiento en memoria, generación de IDs, búsquedas, filtros y reglas de negocio.
- `src/students/student.ts`: define los campos de un estudiante.
- `src/students/dto/`: valida creación, actualización parcial, cambio de estado y filtros con `class-validator`; transforma texto y filtros con `class-transformer`.
- `src/students/pipes/student-id.pipe.ts`: Pipe personalizado que valida el identificador de ruta y lo transforma a número. Rechaza decimales, negativos, notación exponencial e IDs fuera del rango entero seguro.
- `src/app.module.ts`: importa `StudentsModule` junto con el módulo de cursos existente.

Los DTOs parciales usan `ValidateIf` para omitir únicamente campos ausentes; un campo enviado como `null` debe fallar su validación. La validación de filtros transforma explícitamente `"false"` a `false`.

## Demostración con Postman

1. Iniciar la aplicación.
2. Importar `postman/estudiantes.postman_collection.json` en Postman.
3. Revisar la variable de colección `baseUrl`, inicialmente `http://localhost:3000`.
4. Ejecutar las **30 solicitudes en orden** con Collection Runner. La colección guarda automáticamente los IDs de los dos estudiantes creados y comprueba los códigos HTTP esperados.
5. Revisar las respuestas: creación, consulta, edición parcial, filtros, desactivación, bloqueo de eliminación, reactivación y eliminación; además de errores 400, 404 y 409.

La colección elimina al final los estudiantes que crea, por lo que puede repetirse. Si se interrumpe antes de terminar, reiniciar la API para limpiar los datos en memoria antes de repetirla.

## Verificación automática

```powershell
npm run test:students
npm test
npm run test:e2e
npm run lint
```

`test:students` compila la aplicación y ejecuta ocho pruebas HTTP con el módulo real y el mismo ValidationPipe global del arranque. Cubre CRUD, normalización y unicidad de correo, actualización sin cambios parciales ante conflicto, filtros, estado, inexistentes, IDs inválidos y validación de cuerpos. Usa el ejecutor de pruebas integrado de Node.js y Supertest, ya disponible en el proyecto.

La colección de Postman permite realizar la demostración manual requerida por el enunciado; las pruebas automáticas complementan esa demostración.
