import 'reflect-metadata';
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../dist/app.module.js';
import { StudentsService } from '../dist/students/students.service.js';

const student = {
  name: 'Ana Perez',
  email: 'ana@example.com',
  age: 20,
  career: 'Software',
  semester: 3,
  isActive: true,
};

describe('API de estudiantes (HTTP con aplicación compilada)', () => {
  let app;
  let api;
  before(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
    api = request(app.getHttpServer());
  });
  beforeEach(() => {
    // Reiniciar únicamente el almacenamiento de esta aplicación de prueba.
    const service = app.get(StudentsService);
    service.students = [];
    service.nextId = 1;
  });
  after(async () => {
    await app?.close();
  });

  it('registra, consulta, modifica parcialmente y elimina', async () => {
    const created = await api.post('/students').send(student).expect(201);
    assert.deepEqual(created.body, { ...student, id: 1 });
    await api.get('/students').expect(200).expect([created.body]);
    await api.get('/students/1').expect(200).expect(created.body);
    await api
      .patch('/students/1')
      .send({ semester: 10 })
      .expect(200)
      .expect({ ...created.body, semester: 10 });
    await api.delete('/students/1').expect(204).expect('');
    await api.get('/students/1').expect(404);
    const next = await api.post('/students').send(student).expect(201);
    assert.equal(next.body.id, 2);
  });

  it('normaliza el correo y evita duplicados al crear y editar sin alterar datos', async () => {
    await api
      .post('/students')
      .send({ ...student, email: ' ANA@EXAMPLE.COM ' })
      .expect(201);
    await api.post('/students').send(student).expect(409);
    await api.patch('/students/1').send({ email: student.email }).expect(200);
    await api
      .post('/students')
      .send({ ...student, email: 'luis@example.com' })
      .expect(201);
    await api
      .patch('/students/2')
      .send({ name: 'Cambio', email: 'ANA@example.com' })
      .expect(409);
    const result = await api.get('/students/2').expect(200);
    assert.equal(result.body.name, student.name);
    assert.equal(result.body.email, 'luis@example.com');
  });

  it('el endpoint de estado solo admite isActive y bloquea eliminar inactivos', async () => {
    await api.post('/students').send(student).expect(201);
    await api
      .patch('/students/1/status')
      .send({ isActive: false, name: 'Otro' })
      .expect(400);
    for (const body of [{}, { isActive: 'false' }, { isActive: null }]) {
      await api.patch('/students/1/status').send(body).expect(400);
    }
    await api
      .patch('/students/1/status')
      .send({ isActive: false })
      .expect(200)
      .expect({ ...student, id: 1, isActive: false });
    await api.delete('/students/1').expect(409);
    await api.get('/students/1').expect(200);
    await api.patch('/students/1/status').send({ isActive: true }).expect(200);
    await api.delete('/students/1').expect(204);
  });

  it('filtra por cada criterio y por combinaciones, incluido false', async () => {
    await api.post('/students').send(student).expect(201);
    await api
      .post('/students')
      .send({ ...student, email: 'b@example.com', isActive: false })
      .expect(201);
    await api
      .post('/students')
      .send({
        ...student,
        email: 'c@example.com',
        career: 'Medicina',
        semester: 1,
      })
      .expect(201);
    const cases = [
      ['', [1, 2, 3]],
      ['?career=Software', [1, 2]],
      ['?semester=1', [3]],
      ['?isActive=false', [2]],
      ['?isActive=true', [1, 3]],
      ['?career=Software&semester=3&isActive=false', [2]],
      ['?career=Medicina&semester=3', []],
    ];
    for (const [query, ids] of cases) {
      const result = await api.get(`/students${query}`).expect(200);
      assert.deepEqual(
        result.body.map((item) => item.id),
        ids,
      );
    }
  });

  it('responde 404 antes de operar sobre recursos inexistentes', async () => {
    await api.get('/students/999').expect(404);
    await api.patch('/students/999').send({ name: 'Ana' }).expect(404);
    await api
      .patch('/students/999/status')
      .send({ isActive: false })
      .expect(404);
    await api.delete('/students/999').expect(404);
  });

  it('el Pipe rechaza identificadores inválidos en todas las rutas', async () => {
    for (const id of ['abc', '0', '-1', '1.5', '1e2', '9007199254740992']) {
      await api.get(`/students/${id}`).expect(400);
      await api.patch(`/students/${id}`).send({ age: 21 }).expect(400);
      await api
        .patch(`/students/${id}/status`)
        .send({ isActive: true })
        .expect(400);
      await api.delete(`/students/${id}`).expect(400);
    }
  });

  it('rechaza datos inválidos, null, id y propiedades desconocidas', async () => {
    const invalid = [
      { name: '   ' },
      { email: 'sin-correo' },
      { age: 0 },
      { age: 2.5 },
      { age: '20' },
      { career: '' },
      { semester: 0 },
      { semester: 11 },
      { semester: 1.5 },
      { semester: '3' },
      { isActive: 'false' },
      { id: 9 },
      { other: true },
      ...Object.keys(student).map((key) => ({ [key]: null })),
    ];
    await api.post('/students').send({}).expect(400);
    await api.post('/students').send(student).expect(201);
    for (const input of invalid) {
      await api
        .post('/students')
        .send({ ...student, ...input })
        .expect(400);
      await api.patch('/students/1').send(input).expect(400);
    }
    await api
      .get('/students/1')
      .expect(200)
      .expect({ ...student, id: 1 });
    await api
      .patch('/students/1')
      .send({})
      .expect(200)
      .expect({ ...student, id: 1 });
  });

  it('rechaza filtros inválidos y repetidos', async () => {
    for (const query of [
      'semester=0',
      'semester=11',
      'semester=abc',
      'semester=',
      'semester=1.5',
      'isActive=0',
      'isActive=FALSE',
      'isActive=',
      'career=',
      'semester=1&semester=2',
      'isActive=true&isActive=false',
      'unknown=value',
    ]) {
      await api.get(`/students?${query}`).expect(400);
    }
  });
});
