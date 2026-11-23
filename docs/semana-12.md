# Semana 12 · Pruebas unitarias con Jest

Se completaron las sesiones 23 y 24 y el proyecto integrador. Esta semana protege
las reglas existentes mediante pruebas; las rutas y los permisos conservan su
comportamiento de la semana 11.

## Qué cambió y para qué sirve cada archivo

- `jest.config.mjs`: configura Jest para ejecutar los archivos `src/**/*.spec.ts`
  en Node. `ts-jest` transforma TypeScript respetando los módulos ESM y la metadata
  de los decoradores de Nest. El mapeo de `.js` permite resolver el código `.ts`
  que usan los imports NodeNext. La cobertura se limita a las dos unidades de
  esta entrega; no es un porcentaje de toda la API.
- `tsconfig.spec.json`: permite comprobar los tipos de producción y de las
  pruebas unitarias sin generar archivos. Las funciones de Jest se importan
  explícitamente para no mezclarlas con los tipos de Vitest.
- `src/courses/application/update-course.use-case.spec.ts`: contiene 15 casos
  que ejecutan el caso de uso real con un repositorio simulado con `jest.fn()`.
  Cada prueba recibe un repositorio nuevo y un curso congelado; no depende de
  datos previos ni puede modificar accidentalmente la entrada compartida.
- `src/courses/courses.controller.spec.ts`: reemplaza la comprobación de que el
  controlador «existe» por 8 casos de delegación y propagación de errores. Nest
  construye un módulo de prueba pequeño con servicio y caso de uso simulados.
  No se importa `AppModule`, no se inicia un servidor ni se configura TypeORM.
- `src/app.controller.spec.ts`, `src/config/environment.spec.ts` y
  `src/courses/courses.service.spec.ts`: conservan sus pruebas anteriores e
  importan las funciones de Jest para ejecutar todo el conjunto con el mismo
  corredor. La prueba del servicio sigue siendo una comprobación básica de
  construcción; no se cuenta como evidencia de todas sus reglas.
- `scripts/demonstrate-week12.mjs`: ejecuta la demostración de fallo intencional,
  restaura la regla original con `finally` y vuelve a ejecutar las 23 pruebas de
  las dos unidades. Comprueba que el fallo corresponde a la prueba esperada.
- `package.json` y `package-lock.json`: agregan Jest, sus APIs y `ts-jest`, además
  de los comandos descritos abajo. Se retiró la configuración unitaria de Vitest;
  el comando e2e anterior conserva su configuración independiente de Vitest.
- `output/semana-12-verificacion.json`: resume la ejecución, la cobertura y la
  demostración sin guardar credenciales ni tokens.

## Sesión 23: comprobar las decisiones del caso de uso

La unidad real es `UpdateCourseUseCase`. Solo se simulan `findById` y `save` del
puerto `CourseRepository`. Se preparan entradas, se ejecuta `execute` y después
se comprueban el resultado y las interacciones: Arrange, Act, Assert.

Los 15 casos cubren:

1. El docente propietario actualiza título y nivel sin mutar el curso original.
2. El administrador actualiza un curso de otro docente.
3. El administrador actualiza un curso antiguo sin propietario.
4. Una actualización de título conserva el nivel.
5. Una actualización de nivel conserva el título.
6. Un DTO vacío conserva los campos; mantiene el comportamiento ya existente.
7. Un curso inexistente lanza `CourseNotFoundError` y no llama a `save`.
8. Un docente ajeno lanza `CoursePermissionError` antes de guardar.
9. Un estudiante con el mismo id del propietario también queda rechazado.
10. Un estudiante ajeno queda rechazado.
11. Un docente no puede apropiarse de un curso antiguo sin propietario.
12. Campos adicionales como `id` o `createdByUserId` no cambian esos valores,
    incluso si se llama al caso de uso sin pasar por HTTP.
13. El resultado devuelto es el confirmado por el repositorio.
14. Un fallo de lectura se propaga y no provoca una escritura.
15. Un fallo al guardar se propaga y no produce un resultado de éxito.

En un rechazo se comprueba tanto el error como que `save` no se llamó. Si solo
se comprobara la excepción, podría pasar inadvertida una escritura anterior al
rechazo. El caso de uso conserva errores de dominio independientes de Nest;
el filtro global de la semana 11 los traduce a 404/403 durante una petición.
Estas pruebas unitarias no comprueban esa traducción HTTP.

## Sesión 24: comprobar la delegación del controlador

La unidad real es `CoursesController`; su caso de uso y su servicio son dobles.
La prueba de actualización comprueba que `execute` recibe una sola vez el id,
el DTO y la misma identidad autenticada, conservando las referencias de los
objetos. El controlador devuelve el resultado recibido.

Tres casos comprueban que los errores de permiso, recurso ausente y fallo
inesperado se propagan sin transformarse en un falso éxito. Otros cuatro
comprueban la delegación de listado, detalle, creación y eliminación.

Las llamadas son directas a métodos del controlador. Los guards se sustituyen
en el módulo aislado y no se ejecuta el pipeline HTTP: estas pruebas no prueban
JWT, roles del guard, `ParseIntPipe`, validación de DTO, códigos HTTP ni PostgreSQL.
Las pruebas HTTP anteriores permanecen separadas.

## Cómo ejecutarlo

Desde la raíz del proyecto, con Node.js 24 y las dependencias instaladas:

```bash
npm ci
npm test -- --runInBand
npm test -- update-course
npm run test:week12
npm run test:types
npm run test:cov -- --runInBand
npm run demo:week12
```

Las pruebas unitarias no necesitan `.env`, PostgreSQL, JWT ni una API encendida.
`npm test` ejecuta las cinco suites unitarias. `test:week12` selecciona las dos
de esta entrega. El informe HTML de cobertura queda en
`coverage/index.html` y no se sube a Git. Node puede mostrar el aviso de módulos
VM experimentales al ejecutar Jest con ESM.

## Demostración: una prueba que detecta una regla rota

`npm run demo:week12` hace lo siguiente de forma secuencial:

1. Ejecuta la prueba «rechaza al docente ajeno antes de guardar»: pasa.
2. Sustituye temporalmente la comparación del propietario por `true`. El rol
   sigue siendo docente, pero ya no se comprueba a quién pertenece el curso.
3. Ejecuta esa prueba: falla porque la promesa se resuelve cuando debía
   rechazarla con `CoursePermissionError`. Esta falla es deliberada.
4. Restaura el archivo original, comprueba que su contenido sea idéntico y
   ejecuta las 23 pruebas del caso de uso y del controlador: todas pasan.

La demostración modifica temporalmente el archivo del caso de uso. Déjala
terminar y ejecútala sin editar ese archivo al mismo tiempo. No usa la base de
datos. El código defectuoso nunca forma parte de la entrega.

Si se borrara esa prueba, se perdería una comprobación directa de que un docente
ajeno no puede editar ni provocar una llamada a `save`. Otros casos podrían
seguir detectando determinados errores, pero no reemplazan esa regla explícita.

## Resultado e interpretación de la cobertura

Pasaron 55 pruebas en 5 suites. De ellas, 23 corresponden a esta semana:
15 del caso de uso y 8 del controlador. También pasaron compilación, revisión
de tipos y lint. Se verificó el conjunto con conexiones de red bloqueadas.

El caso de uso alcanzó 100 % de líneas, funciones, sentencias y ramas. El
controlador alcanzó 100 % de líneas, funciones y sentencias, y 58,33 % de ramas.
La cobertura conjunta de ramas fue 79,16 %. El informe señala las líneas de
decoradores y metadata del controlador; no se agregaron casos artificiales
solo para aumentar el porcentaje.

Un 100 % de líneas no demuestra que se comprueben correctamente los resultados.
La prueba que detecta la regla rota aporta evidencia adicional. Tampoco estos
porcentajes sustituyen revisión de código ni pruebas de integración.

## Referencias del curso

- [Objetivos de semana 12](https://epanchanaf.github.io/nestjs-course/semana-12/objetivos).
- [Sesión 23](https://epanchanaf.github.io/nestjs-course/semana-12/sesion-23).
- [Sesión 24](https://epanchanaf.github.io/nestjs-course/semana-12/sesion-24).
- [Proyecto integrador](https://epanchanaf.github.io/nestjs-course/semana-12/proyecto-integrador).
- [Jest con módulos ESM](https://jestjs.io/docs/ecmascript-modules).
- [Mocks tipados de Jest](https://jestjs.io/docs/mock-function-api).
- [Soporte ESM de ts-jest](https://kulshekhar.github.io/ts-jest/docs/guides/esm-support).
