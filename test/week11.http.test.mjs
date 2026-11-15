import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { Controller, Get, ValidationPipe, HttpException } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { createTestDatabase } from './database.mjs';
import { User } from '../dist/users/entities/user.entity.js';
import { Course } from '../dist/courses/entities/course.entity.js';
import { HttpErrorFilter } from '../dist/common/filters/http-error.filter.js';
import { TimingInterceptor } from '../dist/common/interceptors/timing.interceptor.js';
import { RequestLoggerMiddleware } from '../dist/common/middleware/request-logger.middleware.js';

describe('Semanas 10 y 11: autorización y controles transversales reales', () => {
  let database, app, api, users, courses, jwt, course;
  const accounts = {};
  const logs = [];
  const logger = {
    log: (message) => logs.push(String(message)),
    error: () => {},
    warn: () => {},
    debug: () => {},
    verbose: () => {},
  };
  before(async () => {
    database = await createTestDatabase();
    app = await database.open();
    app.useLogger(logger);
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    api = request(app.getHttpServer());
    jwt = app.get(JwtService);
    users = app.get(getDataSourceToken()).getRepository(User);
    courses = app.get(getDataSourceToken()).getRepository(Course);
    for (const [name, role] of [
      ['admin', 'admin'],
      ['owner', 'teacher'],
      ['other', 'teacher'],
      ['student', 'student'],
    ]) {
      const user = await users.save(
        users.create({
          email: name + '@example.com',
          role,
          passwordHash: 'fixture-no-login',
        }),
      );
      accounts[name] = {
        ...user,
        token: await jwt.signAsync({ sub: user.id, email: user.email }),
      };
    }
    course = (
      await api
        .post('/courses')
        .set('Authorization', 'Bearer ' + accounts.owner.token)
        .send({ title: 'Curso propietario', level: 'beginner' })
        .expect(201)
    ).body;
  });
  after(async () => {
    try {
      await app?.close();
    } finally {
      await database?.cleanup();
    }
  });
  const auth = (req, name) =>
    req.set('Authorization', 'Bearer ' + accounts[name].token);
  const errorShape = (response, status) => {
    assert.equal(response.body.statusCode, status);
    assert.equal(typeof response.body.path, 'string');
    assert.ok(!Number.isNaN(Date.parse(response.body.timestamp)));
    assert.equal(response.body.requestId, response.headers['x-request-id']);
    assert.equal(Object.hasOwn(response.body, 'stack'), false);
  };
  it('registro público crea student y rechaza que el cliente elija admin', async () => {
    const password = randomBytes(24).toString('base64url');
    await api
      .post('/auth/register')
      .send({ email: 'injected@example.com', password, role: 'admin' })
      .expect(400);
    const registered = await api
      .post('/auth/register')
      .send({ email: 'normal@example.com', password })
      .expect(201);
    assert.equal(
      (await users.findOneBy({ id: registered.body.id })).role,
      'student',
    );
    assert.equal(Object.hasOwn(registered.body, 'passwordHash'), false);
  });
  it('misma actualización: 401, 403, 403, 200 y 200', async () => {
    const route = '/courses/' + course.id;
    errorShape(
      await api.patch(route).send({ title: 'Sin token' }).expect(401),
      401,
    );
    errorShape(
      await auth(api.patch(route), 'student')
        .send({ title: 'Estudiante' })
        .expect(403),
      403,
    );
    errorShape(
      await auth(api.patch(route), 'other')
        .send({ title: 'Ajeno' })
        .expect(403),
      403,
    );
    assert.equal(
      (await courses.findOneBy({ id: course.id })).title,
      'Curso propietario',
    );
    assert.equal(
      (
        await auth(api.patch(route), 'owner')
          .send({ title: 'Docente' })
          .expect(200)
      ).body.title,
      'Docente',
    );
    assert.equal(
      (
        await auth(api.patch(route), 'admin')
          .send({ title: 'Administrador' })
          .expect(200)
      ).body.title,
      'Administrador',
    );
  });
  it('solo admin elimina; un 403 no borra el recurso', async () => {
    const extra = await courses.save(
      courses.create({
        title: 'Eliminar',
        level: 'beginner',
        createdByUserId: accounts.owner.id,
      }),
    );
    await auth(api.delete('/courses/' + extra.id), 'owner').expect(403);
    assert.ok(await courses.findOneBy({ id: extra.id }));
    await auth(api.delete('/courses/' + extra.id), 'admin').expect(200);
    assert.equal(await courses.findOneBy({ id: extra.id }), null);
  });
  it('no se admite propietario inyectado; DTO sigue validando', async () => {
    const beforeCount = await courses.count();
    await auth(api.post('/courses'), 'student')
      .send({ title: 'No', level: 'beginner' })
      .expect(403);
    await auth(api.post('/courses'), 'owner')
      .send({ title: 'No', level: 'experto' })
      .expect(400);
    await auth(api.post('/courses'), 'owner')
      .send({
        title: 'No',
        level: 'beginner',
        createdByUserId: accounts.other.id,
      })
      .expect(400);
    await auth(api.patch('/courses/' + course.id), 'owner')
      .send({ createdByUserId: accounts.other.id })
      .expect(400);
    assert.equal(await courses.count(), beforeCount);
    assert.equal(
      (await courses.findOneBy({ id: course.id })).createdByUserId,
      accounts.owner.id,
    );
  });
  it('400 y 404 comparten estructura y no exponen trazas', async () => {
    errorShape(
      await auth(api.patch('/courses/no-numero'), 'admin')
        .send({ title: 'X' })
        .expect(400),
      400,
    );
    errorShape(
      await auth(api.patch('/courses/2147483000'), 'admin')
        .send({ title: 'X' })
        .expect(404),
      404,
    );
  });
  it('JWT no concede roles; cambios y eliminación de cuenta se reflejan inmediatamente', async () => {
    const claimed = await jwt.signAsync({
      sub: accounts.student.id,
      email: accounts.student.email,
      role: 'admin',
    });
    await api
      .delete('/courses/' + course.id)
      .set('Authorization', 'Bearer ' + claimed)
      .expect(403);
    const temp = await users.save(
      users.create({
        email: 'temporary@example.com',
        role: 'admin',
        passwordHash: 'fixture-only',
      }),
    );
    const token = await jwt.signAsync({ sub: temp.id, email: temp.email });
    await users.update(temp.id, { role: 'student' });
    const me = await api
      .get('/auth/me')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    assert.deepEqual(me.body, {
      id: temp.id,
      email: temp.email,
      role: 'student',
    });
    await api
      .delete('/courses/' + course.id)
      .set('Authorization', 'Bearer ' + token)
      .expect(403);
    await users.delete(temp.id);
    await api
      .get('/auth/me')
      .set('Authorization', 'Bearer ' + token)
      .expect(401);
  });
  it('CORS permite el origen configurado y no autoriza un origen ajeno', async () => {
    const allowed = await api
      .get('/courses')
      .set('Origin', 'http://localhost:3001')
      .expect(200);
    assert.equal(
      allowed.headers['access-control-allow-origin'],
      'http://localhost:3001',
    );
    const denied = await api
      .get('/courses')
      .set('Origin', 'https://untrusted.example')
      .expect(200);
    assert.equal(denied.headers['access-control-allow-origin'], undefined);
    const preflight = await api
      .options('/courses')
      .set('Origin', 'http://localhost:3001')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type')
      .expect(204);
    assert.match(
      preflight.headers['access-control-allow-headers'],
      /Authorization/i,
    );
    await api
      .post('/courses')
      .set('Origin', 'http://localhost:3001')
      .send({ title: 'No', level: 'beginner' })
      .expect(401);
  });
  it('middleware e interceptor correlacionan y miden sin registrar secretos', async () => {
    const secret = 'NEVER_LOG_' + randomBytes(8).toString('hex');
    const response = await api
      .get('/courses')
      .set('Authorization', 'Bearer ' + secret)
      .query({ secret })
      .expect(400);
    assert.ok(response.headers['x-request-id']);
    assert.match(response.headers['x-response-time'], /^\d+(\.\d+)?ms$/);
    const text = logs.join('\n');
    assert.ok(text.includes('durationMs'));
    assert.ok(!text.includes(secret));
    assert.ok(!text.includes(accounts.admin.token));
    assert.ok(!text.includes('Authorization'));
  });
  it('cinco intentos de login y el sexto 429 con Retry-After', async () => {
    for (let i = 0; i < 5; i++)
      await api
        .post('/auth/login')
        .send({ email: 'absent@example.com', password: 'Solo-pruebas-2026' })
        .expect(401);
    const limited = await api
      .post('/auth/login')
      .send({ email: 'absent@example.com', password: 'Solo-pruebas-2026' })
      .expect(429);
    errorShape(limited, 429);
    assert.ok(Number(limited.headers['retry-after']) > 0);
  });
});

it('filter global sanea 500 de práctica sin exponer SQL o secretos', async () => {
  const secret = 'private SQL password sensitive';
  class ProbeController {
    crash() {
      throw new Error(secret);
    }
    crashHttp() {
      throw new HttpException({ message: secret, error: secret }, 500);
    }
  }
  Controller('probe')(ProbeController);
  Get('crash')(
    ProbeController.prototype,
    'crash',
    Object.getOwnPropertyDescriptor(ProbeController.prototype, 'crash'),
  );
  Get('crash-http')(
    ProbeController.prototype,
    'crashHttp',
    Object.getOwnPropertyDescriptor(ProbeController.prototype, 'crashHttp'),
  );
  const module = await Test.createTestingModule({
    controllers: [ProbeController],
    providers: [
      { provide: APP_FILTER, useClass: HttpErrorFilter },
      { provide: APP_INTERCEPTOR, useClass: TimingInterceptor },
    ],
  }).compile();
  const app = module.createNestApplication({ logger: false });
  const middleware = new RequestLoggerMiddleware();
  app.use(middleware.use.bind(middleware));
  try {
    await app.init();
    const response = await request(app.getHttpServer())
      .get('/probe/crash')
      .expect(500);
    assert.equal(response.body.message, 'Internal server error');
    assert.ok(!JSON.stringify(response.body).includes(secret));
    assert.ok(!('stack' in response.body));
    assert.ok(response.headers['x-request-id']);
    const httpError = await request(app.getHttpServer())
      .get('/probe/crash-http')
      .expect(500);
    assert.equal(httpError.body.message, 'Internal server error');
    assert.ok(!JSON.stringify(httpError.body).includes(secret));
  } finally {
    await app.close();
  }
});
