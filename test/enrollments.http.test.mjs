import 'reflect-metadata';
import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../dist/app.module.js';

const student = {
  name: 'Ana Perez',
  email: 'ana@example.com',
  age: 20,
  career: 'Software',
  semester: 3,
  isActive: true,
};

describe('Integración de Cursos, Estudiantes y Matrículas', () => {
  let app;
  let api;
  beforeEach(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
    api = request(app.getHttpServer());
    await api.post('/students').send(student).expect(201);
  });
  afterEach(async () => {
    await app?.close();
  });

  it('registra una matrícula y comparte los datos de Cursos y Estudiantes', async () => {
    const course = await api
      .post('/courses')
      .send({ title: 'Curso de prueba', level: 'beginner' })
      .expect(201);
    const body = { studentId: 1, courseId: course.body.id };
    await api
      .post('/enrollments')
      .send(body)
      .expect(201)
      .expect({ id: 1, ...body });
    await api
      .get('/enrollments')
      .expect(200)
      .expect([{ id: 1, ...body }]);
  });

  it('rechaza duplicados e inactivos sin consumir identificadores', async () => {
    await api
      .post('/enrollments')
      .send({ studentId: 1, courseId: 1 })
      .expect(201);
    const duplicate = await api
      .post('/enrollments')
      .send({ studentId: 1, courseId: 1 })
      .expect(409);
    assert.equal(
      duplicate.body.message,
      'El estudiante ya está matriculado en este curso',
    );
    await api.patch('/students/1/status').send({ isActive: false }).expect(200);
    const inactive = await api
      .post('/enrollments')
      .send({ studentId: 1, courseId: 2 })
      .expect(409);
    assert.equal(
      inactive.body.message,
      'No se puede matricular a un estudiante inactivo',
    );
    await api.patch('/students/1/status').send({ isActive: true }).expect(200);
    await api
      .post('/enrollments')
      .send({ studentId: 1, courseId: 2 })
      .expect(201)
      .expect({ id: 2, studentId: 1, courseId: 2 });
  });

  it('responde 404 para recursos inexistentes y no guarda la matrícula', async () => {
    for (const body of [
      { studentId: 999, courseId: 1 },
      { studentId: 1, courseId: 999 },
    ]) {
      await api.post('/enrollments').send(body).expect(404);
    }
    await api.get('/students/999/enrollments').expect(404);
    await api.get('/courses/999/enrollments').expect(404);
    await api.delete('/enrollments/999').expect(404);
    await api.get('/enrollments').expect(200).expect([]);
  });

  it('filtra por estudiante, curso y la intersección de ambos', async () => {
    await api
      .post('/students')
      .send({ ...student, email: 'luis@example.com' })
      .expect(201);
    for (const body of [
      { studentId: 1, courseId: 1 },
      { studentId: 1, courseId: 2 },
      { studentId: 2, courseId: 1 },
    ]) {
      await api.post('/enrollments').send(body).expect(201);
    }
    for (const [url, ids] of [
      ['/enrollments', [1, 2, 3]],
      ['/enrollments?studentId=1', [1, 2]],
      ['/enrollments?courseId=1', [1, 3]],
      ['/enrollments?studentId=1&courseId=1', [1]],
      ['/enrollments?studentId=2&courseId=2', []],
      ['/enrollments?studentId=999', []],
      ['/students/1/enrollments', [1, 2]],
      ['/courses/1/enrollments', [1, 3]],
      ['/courses/3/enrollments', []],
    ]) {
      const result = await api.get(url).expect(200);
      assert.deepEqual(
        result.body.map((item) => item.id),
        ids,
      );
    }
  });

  it('cancela sin borrar otras matrículas y permite volver a matricular', async () => {
    await api
      .post('/enrollments')
      .send({ studentId: 1, courseId: 1 })
      .expect(201);
    await api
      .post('/enrollments')
      .send({ studentId: 1, courseId: 2 })
      .expect(201);
    await api.delete('/enrollments/1').expect(204).expect('');
    await api.delete('/enrollments/1').expect(404);
    await api
      .get('/enrollments')
      .expect(200)
      .expect([{ id: 2, studentId: 1, courseId: 2 }]);
    await api
      .post('/enrollments')
      .send({ studentId: 1, courseId: 1 })
      .expect(201)
      .expect({ id: 3, studentId: 1, courseId: 1 });
    await api.get('/students/1').expect(200);
    await api.get('/courses/1').expect(200);
  });

  it('rechaza body incompleto, tipos inválidos y propiedades adicionales', async () => {
    for (const body of [
      {},
      { studentId: 1 },
      { courseId: 1 },
      { studentId: 1, courseId: 1, id: 5 },
      ...['1', 0, -1, 1.5, null, true, 9007199254740992].flatMap((value) => [
        { studentId: value, courseId: 1 },
        { studentId: 1, courseId: value },
      ]),
    ]) {
      await api.post('/enrollments').send(body).expect(400);
    }
    await api.get('/enrollments').expect(200).expect([]);
  });

  it('valida los filtros y los identificadores de todas las rutas nuevas', async () => {
    for (const query of [
      'studentId=',
      'courseId=abc',
      'studentId=0',
      'courseId=-1',
      'studentId=1.5',
      'courseId=9007199254740992',
      'studentId=1&studentId=2',
      'courseId=1&courseId=2',
      'other=1',
    ]) {
      await api.get(`/enrollments?${query}`).expect(400);
    }
    for (const id of ['abc', '0', '-1', '1.5', '1e2', '9007199254740992']) {
      await api.get(`/students/${id}/enrollments`).expect(400);
      await api.get(`/courses/${id}/enrollments`).expect(400);
      await api.delete(`/enrollments/${id}`).expect(400);
    }
  });
});
