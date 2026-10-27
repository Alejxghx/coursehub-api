import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestDatabase } from './database.mjs';
import { validateEnvironment } from '../dist/config/environment.js';

// Real HTTP, bcrypt, JWT and PostgreSQL in a temporary, automatically removed schema.
// Only sanitized observations are written: no secret, password, hash or full token.
const database = await createTestDatabase();
let app;
const evidence = {
  session: 17,
  checkedAt: new Date().toISOString(),
  mode: 'HTTP real y PostgreSQL en esquema temporal',
  cases: [],
};
const credentials = {
  email: 'aprendo-jwt@example.com',
  password: randomBytes(24).toString('base64url'),
};
async function open() {
  app = await database.open();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  return request(app.getHttpServer());
}
try {
  let api = await open();
  const registered = await api
    .post('/auth/register')
    .send(credentials)
    .expect(201);
  evidence.cases.push({
    case: 'Registro',
    method: 'POST',
    path: '/auth/register',
    status: 201,
    body: registered.body,
  });
  const duplicate = await api
    .post('/auth/register')
    .send({ ...credentials, email: credentials.email.toUpperCase() })
    .expect(409);
  evidence.cases.push({
    case: 'Correo duplicado',
    status: 409,
    body: duplicate.body,
  });
  const login = await api.post('/auth/login').send(credentials).expect(200);
  const { accessToken, user } = login.body;
  assert.deepEqual(user, registered.body);
  const jwt = app.get(JwtService);
  const payload = await jwt.verifyAsync(accessToken, { algorithms: ['HS256'] });
  assert.deepEqual(Object.keys(payload).sort(), ['email', 'exp', 'iat', 'sub']);
  assert.equal(payload.exp - payload.iat, 900);
  evidence.cases.push({
    case: 'Login válido',
    status: 200,
    body: { accessToken: '[OMITIDO: credencial]', user },
    verifiedPayload: payload,
    lifetimeSeconds: payload.exp - payload.iat,
  });
  for (const [label, input] of [
    [
      'Password incorrecta',
      { ...credentials, password: randomBytes(24).toString('base64url') },
    ],
    [
      'Correo inexistente',
      { ...credentials, email: 'missing-jwt@example.com' },
    ],
  ]) {
    const response = await api.post('/auth/login').send(input).expect(401);
    assert.equal(Object.hasOwn(response.body, 'accessToken'), false);
    evidence.cases.push({ case: label, status: 401, body: response.body });
  }
  const invalid = await api
    .post('/auth/login')
    .send({ ...credentials, email: 'invalid' })
    .expect(400);
  evidence.cases.push({
    case: 'DTO inválido',
    status: 400,
    body: invalid.body,
  });
  const altered = accessToken.split('.');
  altered[1] = Buffer.from(JSON.stringify({ ...payload, sub: 999 })).toString(
    'base64url',
  );
  await assert.rejects(jwt.verifyAsync(altered.join('.')), /invalid signature/);
  evidence.cases.push({
    case: 'Payload alterado',
    result: 'Firma inválida; decode no basta',
  });
  await assert.rejects(
    jwt.verifyAsync(accessToken, { secret: randomBytes(48).toString('hex') }),
    /invalid signature/,
  );
  evidence.cases.push({
    case: 'Secreto cambiado',
    result: 'Token anterior rechazado por firma inválida',
  });
  const short = await jwt.signAsync(
    { sub: user.id, email: user.email },
    { expiresIn: '1s' },
  );
  const expiration = jwt.decode(short).exp;
  await assert.rejects(
    jwt.verifyAsync(short, { clockTimestamp: expiration }),
    (error) => error.name === 'TokenExpiredError',
  );
  evidence.cases.push({
    case: 'Caducidad',
    result:
      'Token de 1s rechazado en exp mediante reloj de verificación controlado',
  });
  const withoutSecret = { ...process.env };
  delete withoutSecret.JWT_SECRET;
  assert.throws(() => validateEnvironment(withoutSecret), /JWT_SECRET/);
  evidence.cases.push({
    case: 'JWT_SECRET ausente',
    result: 'Configuración rechazada',
  });
  await app.close();
  app = undefined;
  api = await open();
  const afterRestart = await api
    .post('/auth/login')
    .send(credentials)
    .expect(200);
  assert.deepEqual(afterRestart.body.user, user);
  await app.get(JwtService).verifyAsync(accessToken);
  evidence.cases.push({
    case: 'Reinicio de Nest y conexión',
    result:
      'Cuenta persistente; nuevo login 200; token previo válido con el mismo secreto',
  });
  for (const path of ['/courses', '/students', '/enrollments']) {
    await api.get(path).expect(200);
    evidence.cases.push({
      case: 'Ruta existente',
      method: 'GET',
      path,
      status: 200,
    });
  }
  await mkdir('output', { recursive: true });
  await writeFile(
    'output/sesion-17-verificacion.json',
    JSON.stringify(evidence, null, 2) + '\n',
  );
  console.log(
    `${evidence.cases.length} comprobaciones correctas. Evidencia guardada sin credenciales.`,
  );
} finally {
  try {
    await app?.close();
  } finally {
    await database.cleanup();
  }
}
