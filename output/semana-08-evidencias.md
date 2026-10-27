# Evidencia de comprobación — Semana 8

Fecha: 20 de octubre de 2026.

Ejecución automatizada real de las colecciones de sesiones 15 y 16 contra el proceso de la API compilada y PostgreSQL 16 temporal. No es una grabación de Postman ni una presentación oral. Las contraseñas se generaron en memoria y se omiten de este documento; los hashes tampoco se incluyen.

## Sesión 15

### 01 — Registro válido: 201

Método: POST. Ruta: /auth/register. Estado recibido: **201**. Aserciones: correctas.

Plantilla de solicitud compartida (sin contraseña):

```text
{
  "email": "{{registrationEmail}}",
  "password": {{practicePasswordJson}}
}
```

Respuesta real:

```json
{
  "id": 1,
  "email": "sesion15-59f73db7-75f5-4cd1-820f-4e524a2dcc86@example.com",
  "createdAt": "2026-10-20T18:46:11.501Z"
}
```

### 02 — Correo duplicado con mayúsculas: 409

Método: POST. Ruta: /auth/register. Estado recibido: **409**. Aserciones: correctas.

Plantilla de solicitud compartida (sin contraseña):

```text
{
  "email": "{{uppercaseEmail}}",
  "password": {{practicePasswordJson}}
}
```

Respuesta real:

```json
{
  "message": "El correo ya está registrado",
  "error": "Conflict",
  "statusCode": 409
}
```

### 03 — Sin email: 400

Método: POST. Ruta: /auth/register. Estado recibido: **400**. Aserciones: correctas.

Plantilla de solicitud compartida (sin contraseña):

```text
{
  "password": {{practicePasswordJson}}
}
```

Respuesta real:

```json
{
  "message": [
    "email must be an email"
  ],
  "error": "Bad Request",
  "statusCode": 400
}
```

### 04 — Sin password: 400

Método: POST. Ruta: /auth/register. Estado recibido: **400**. Aserciones: correctas.

Plantilla de solicitud compartida (sin contraseña):

```text
{
  "email": "{{registrationEmail}}"
}
```

Respuesta real:

```json
{
  "message": [
    "password's byte length must fall into (0, 72) range",
    "password must be shorter than or equal to 72 characters",
    "password must be longer than or equal to 8 characters",
    "password must be a string"
  ],
  "error": "Bad Request",
  "statusCode": 400
}
```

### 05 — Correo inválido: 400

Método: POST. Ruta: /auth/register. Estado recibido: **400**. Aserciones: correctas.

Plantilla de solicitud compartida (sin contraseña):

```text
{
  "email": "no-es-correo",
  "password": {{practicePasswordJson}}
}
```

Respuesta real:

```json
{
  "message": [
    "email must be an email"
  ],
  "error": "Bad Request",
  "statusCode": 400
}
```

### 06 — Contraseña de siete caracteres: 400

Método: POST. Ruta: /auth/register. Estado recibido: **400**. Aserciones: correctas.

Plantilla de solicitud compartida (sin contraseña):

```text
{
  "email": "{{registrationEmail}}",
  "password": {{shortPasswordJson}}
}
```

Respuesta real:

```json
{
  "message": [
    "password must be longer than or equal to 8 characters"
  ],
  "error": "Bad Request",
  "statusCode": 400
}
```

## Sesión 16

### Comprobación segura en PostgreSQL

La inspección devuelve únicamente indicadores sobre la columna del hash:

```json
[
  {
    "id": 2,
    "email": "sesion16-bf0b4ade-fb0b-48de-ab57-ea13139a4853@example.com",
    "created_at": "2026-10-20T18:46:11.875Z",
    "tiene_hash": true,
    "formato_bcrypt": true
  }
]
```

### 01 — Registrar primera cuenta: 201

Método: POST. Ruta: /auth/register. Estado recibido: **201**. Aserciones: correctas.

Plantilla de solicitud compartida (sin contraseña):

```text
{
  "email": "{{registrationEmail}}",
  "password": {{practicePasswordJson}}
}
```

Respuesta real:

```json
{
  "id": 2,
  "email": "sesion16-bf0b4ade-fb0b-48de-ab57-ea13139a4853@example.com",
  "createdAt": "2026-10-20T18:46:11.875Z"
}
```

### 02 — Registrar segunda cuenta de práctica: 201

Método: POST. Ruta: /auth/register. Estado recibido: **201**. Aserciones: correctas.

Plantilla de solicitud compartida (sin contraseña):

```text
{
  "email": "{{secondEmail}}",
  "password": {{practicePasswordJson}}
}
```

Respuesta real:

```json
{
  "id": 3,
  "email": "sesion16-second-bf0b4ade-fb0b-48de-ab57-ea13139a4853@example.com",
  "createdAt": "2026-10-20T18:46:12.072Z"
}
```

### 03 — Registro duplicado con mayúsculas: 409

Método: POST. Ruta: /auth/register. Estado recibido: **409**. Aserciones: correctas.

Plantilla de solicitud compartida (sin contraseña):

```text
{
  "email": "{{uppercaseEmail}}",
  "password": {{practicePasswordJson}}
}
```

Respuesta real:

```json
{
  "message": "El correo ya está registrado",
  "error": "Conflict",
  "statusCode": 409
}
```

### 04 — Login correcto con correo normalizado: 200

Método: POST. Ruta: /auth/login. Estado recibido: **200**. Aserciones: correctas.

Plantilla de solicitud compartida (sin contraseña):

```text
{
  "email": " {{uppercaseEmail}} ",
  "password": {{practicePasswordJson}}
}
```

Respuesta real:

```json
{
  "id": 2,
  "email": "sesion16-bf0b4ade-fb0b-48de-ab57-ea13139a4853@example.com",
  "createdAt": "2026-10-20T18:46:11.875Z"
}
```

### 05 — Contraseña incorrecta: 401

Método: POST. Ruta: /auth/login. Estado recibido: **401**. Aserciones: correctas.

Plantilla de solicitud compartida (sin contraseña):

```text
{
  "email": "{{registrationEmail}}",
  "password": "{{wrongPassword}}"
}
```

Respuesta real:

```json
{
  "message": "Invalid credentials",
  "error": "Unauthorized",
  "statusCode": 401
}
```

### 06 — Correo inexistente: el mismo 401

Método: POST. Ruta: /auth/login. Estado recibido: **401**. Aserciones: correctas.

Plantilla de solicitud compartida (sin contraseña):

```text
{
  "email": "{{missingEmail}}",
  "password": {{practicePasswordJson}}
}
```

Respuesta real:

```json
{
  "message": "Invalid credentials",
  "error": "Unauthorized",
  "statusCode": 401
}
```

### 07 — Login con correo mal formado: 400

Método: POST. Ruta: /auth/login. Estado recibido: **400**. Aserciones: correctas.

Plantilla de solicitud compartida (sin contraseña):

```text
{
  "email": "ana-at-example.com",
  "password": {{practicePasswordJson}}
}
```

Respuesta real:

```json
{
  "message": [
    "email must be an email"
  ],
  "error": "Bad Request",
  "statusCode": 400
}
```

### 08 — Login con contraseña corta: 400

Método: POST. Ruta: /auth/login. Estado recibido: **400**. Aserciones: correctas.

Plantilla de solicitud compartida (sin contraseña):

```text
{
  "email": "{{registrationEmail}}",
  "password": {{shortPasswordJson}}
}
```

Respuesta real:

```json
{
  "message": [
    "password must be longer than or equal to 8 characters"
  ],
  "error": "Bad Request",
  "statusCode": 400
}
```

### 09 — Login sin contraseña: 400

Método: POST. Ruta: /auth/login. Estado recibido: **400**. Aserciones: correctas.

Plantilla de solicitud compartida (sin contraseña):

```text
{
  "email": "{{registrationEmail}}"
}
```

Respuesta real:

```json
{
  "message": [
    "password's byte length must fall into (0, 72) range",
    "password must be shorter than or equal to 72 characters",
    "password must be longer than or equal to 8 characters",
    "password must be a string"
  ],
  "error": "Bad Request",
  "statusCode": 400
}
```

### 10 — Registro con cuerpo inválido: 400

Método: POST. Ruta: /auth/register. Estado recibido: **400**. Aserciones: correctas.

Plantilla de solicitud compartida (sin contraseña):

```text
{
  "email": "no-es-correo",
  "password": {{practicePasswordJson}}
}
```

Respuesta real:

```json
{
  "message": [
    "email must be an email"
  ],
  "error": "Bad Request",
  "statusCode": 400
}
```

### 11 — Login de la segunda cuenta: 200

Método: POST. Ruta: /auth/login. Estado recibido: **200**. Aserciones: correctas.

Plantilla de solicitud compartida (sin contraseña):

```text
{
  "email": "{{secondEmail}}",
  "password": {{practicePasswordJson}}
}
```

Respuesta real:

```json
{
  "id": 3,
  "email": "sesion16-second-bf0b4ade-fb0b-48de-ab57-ea13139a4853@example.com",
  "createdAt": "2026-10-20T18:46:12.072Z"
}
```

### 12 — courses sigue disponible: 200

Método: GET. Ruta: /courses. Estado recibido: **200**. Aserciones: correctas.

Respuesta real:

```json
{
  "items": [],
  "meta": {
    "total": 0,
    "page": 1,
    "limit": 10,
    "totalPages": 0
  }
}
```

### 13 — students sigue disponible: 200

Método: GET. Ruta: /students. Estado recibido: **200**. Aserciones: correctas.

Respuesta real:

```json
[]
```

### 14 — enrollments sigue disponible: 200

Método: GET. Ruta: /enrollments. Estado recibido: **200**. Aserciones: correctas.

Respuesta real:

```json
{
  "items": [],
  "meta": {
    "total": 0,
    "page": 1,
    "limit": 10,
    "totalPages": 0
  }
}
```

## Reinicio real del proceso

Se detuvo el proceso de la API y se inició uno nuevo. El login de la primera cuenta de sesión 16 respondió **200** y devolvió la misma identidad. La cuenta y el hash persistieron en PostgreSQL.

## Resultado

21 solicitudes HTTP correctas: 20 de las colecciones y 1 login tras reiniciar el proceso. Las colecciones aprobaron 50 aserciones. Duración de la ejecución: 2.6 segundos.

La demostración personal de hasta ocho minutos se prepara con la secuencia y los tiempos del README. Al mostrarla, conserva privadas las variables de contraseña y evita mostrar el cuerpo HTTP resuelto o el hash.
