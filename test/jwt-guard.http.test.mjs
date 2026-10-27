import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { createTestDatabase } from './database.mjs';
import { CoursesService } from '../dist/courses/courses.service.js';
import { Course } from '../dist/courses/entities/course.entity.js';

describe('Sesión 18: estrategia, guard y rutas protegidas con PostgreSQL', () => {
  let database;
  let app;
  let api;
  let jwt;
  let token;
  let user;
  let payload;
  let courseCalls = 0;
  const credentials = {
    email: 'guard@example.com',
    password: randomBytes(24).toString('base64url'),
  };
  const countCourses = () =>
    app.get(getDataSourceToken()).getRepository(Course).count();

  before(async () => {
    database = await createTestDatabase();
    app = await database.open();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    const courses = app.get(CoursesService);
    const create = courses.create.bind(courses);
    courses.create = (...args) => {
      courseCalls++;
      return create(...args);
    };
    await app.init();
    api = request(app.getHttpServer());
    jwt = app.get(JwtService);
    const register = await api
      .post('/auth/register')
      .send(credentials)
      .expect(201);
    user = register.body;
    const login = await api.post('/auth/login').send(credentials).expect(200);
    assert.deepEqual(login.body.user, user);
    token = login.body.accessToken;
    payload = { sub: user.id, email: user.email };
  });

  after(async () => {
    try {
      await app?.close();
    } finally {
      await database?.cleanup();
    }
  });

  it('login y registro son públicos; me con Bearer válido devuelve identidad mínima', async () => {
    const response = await api
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    assert.deepEqual(response.body, { id: user.id, email: user.email });
  });

  it('sin token, esquema incorrecto o token mal formado: 401 antes del controlador', async () => {
    for (const header of [
      undefined,
      `Token ${token}`,
      'Bearer not-a-jwt',
      'Bearer',
    ]) {
      let req = api.get('/auth/me');
      if (header) req = req.set('Authorization', header);
      const response = await req.expect(401);
      assert.deepEqual(response.body, {
        message: 'Unauthorized',
        statusCode: 401,
      });
    }
    // Query parameters do not substitute for the Authorization header.
    await api.get('/auth/me').query({ accessToken: token }).expect(401);
  });

  it('payload alterado, secreto distinto y algoritmo distinto son rechazados', async () => {
    const changed = token.split('.');
    changed[1] = Buffer.from(
      JSON.stringify({ ...jwt.decode(token), sub: 999 }),
    ).toString('base64url');
    const wrongKey = await jwt.signAsync(payload, {
      secret: randomBytes(48).toString('hex'),
    });
    const wrongAlgorithm = await jwt.signAsync(payload, { algorithm: 'HS512' });
    for (const value of [changed.join('.'), wrongKey, wrongAlgorithm]) {
      await api
        .get('/auth/me')
        .set('Authorization', `Bearer ${value}`)
        .expect(401);
    }
  });

  it('token realmente expirado recibe 401 por HTTP', async () => {
    const expired = await jwt.signAsync(
      { ...payload, iat: Math.floor(Date.now() / 1000) - 60 },
      { expiresIn: '1s' },
    );
    await api
      .get('/auth/me')
      .set('Authorization', `Bearer ${expired}`)
      .expect(401);
  });

  it('claims inválidos o falta de exp reciben 401; claims extras no se filtran', async () => {
    const withoutExpiry = await new JwtService({
      secret: app.get(ConfigService).getOrThrow('JWT_SECRET'),
    }).signAsync(payload);
    for (const value of [
      withoutExpiry,
      await jwt.signAsync({ ...payload, sub: 0 }),
      await jwt.signAsync({ ...payload, sub: '1' }),
      await jwt.signAsync({ ...payload, email: 'not-an-email' }),
    ]) {
      await api
        .get('/auth/me')
        .set('Authorization', `Bearer ${value}`)
        .expect(401);
    }
    const extra = await jwt.signAsync({
      ...payload,
      role: 'admin',
      ignored: 'do-not-copy',
    });
    await api
      .get('/auth/me')
      .set('Authorization', `Bearer ${extra}`)
      .expect(200)
      .expect({ id: user.id, email: user.email });
  });

  it('crear curso sin identidad válida no llama al servicio ni cambia PostgreSQL', async () => {
    const count = await countCourses();
    const beforeCalls = courseCalls;
    for (const header of [undefined, 'Bearer invalid']) {
      let req = api.post('/courses');
      if (header) req = req.set('Authorization', header);
      await req
        .send({ title: 'No debe existir', level: 'beginner' })
        .expect(401);
      assert.equal(await countCourses(), count);
    }
    // Guard runs before DTO pipes: an unauthenticated invalid body is still 401.
    await api.post('/courses').send({ level: 'invalid' }).expect(401);
    assert.equal(courseCalls, beforeCalls);
  });

  it('token válido conserva DTOs y solo crea el curso con un cuerpo válido', async () => {
    const count = await countCourses();
    const beforeCalls = courseCalls;
    for (const body of [
      { title: '', level: 'beginner' },
      { title: 'Nivel inválido', level: 'experto' },
      { title: 'Campo desconocido', level: 'beginner', role: 'admin' },
    ]) {
      await api
        .post('/courses')
        .set('Authorization', `Bearer ${token}`)
        .send(body)
        .expect(400);
      assert.equal(await countCourses(), count);
    }
    assert.equal(courseCalls, beforeCalls);
    const course = await api
      .post('/courses')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Curso con JWT', level: 'beginner' })
      .expect(201);
    assert.equal(course.body.title, 'Curso con JWT');
    assert.equal(await countCourses(), count + 1);
    assert.equal(courseCalls, beforeCalls + 1);
  });

  it('las lecturas públicas siguen disponibles sin encabezado', async () => {
    for (const path of ['/courses', '/students', '/enrollments']) {
      await api.get(path).expect(200);
    }
  });
});
