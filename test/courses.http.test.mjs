import 'reflect-metadata';
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createTestDatabase } from './database.mjs';

it('CRUD de cursos conserva datos después de reiniciar la aplicación', async () => {
  const database = await createTestDatabase();
  let app;
  let api;
  const open = async () => {
    app = await database.open();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
    api = request(app.getHttpServer());
  };
  try {
    await open();
    await api.get('/courses').expect(200).expect([]);
    await api
      .post('/courses')
      .send({ title: '', level: 'invalid' })
      .expect(400);
    const created = await api
      .post('/courses')
      .send({ title: 'Curso persistente de prueba', level: 'beginner' })
      .expect(201);
    const id = created.body.id;
    assert.equal(typeof id, 'number');
    await api
      .post('/courses')
      .send({ title: 'Segundo', level: 'advanced' })
      .expect(201);
    await api
      .post('/courses')
      .send({ title: 'Tercero', level: 'beginner' })
      .expect(201);
    const all = await api.get('/courses').expect(200);
    assert.deepEqual(
      all.body.map((course) => course.id),
      [id, id + 1, id + 2],
    );
    const filtered = await api.get('/courses?level=beginner').expect(200);
    assert.deepEqual(
      filtered.body.map((course) => course.id),
      [id, id + 2],
    );
    await app.close();
    await open();
    await api
      .get('/courses/' + id)
      .expect(200)
      .expect(created.body);
    await api
      .patch('/courses/' + id)
      .send({ level: 'intermediate' })
      .expect(200)
      .expect({ ...created.body, level: 'intermediate' });
    await api
      .patch('/courses/' + id)
      .send({ level: 'invalid' })
      .expect(400);
    await api
      .post('/courses')
      .send({ title: 'Extra', level: 'beginner', extra: true })
      .expect(400);
    await app.close();
    await open();
    await api
      .get('/courses/' + id)
      .expect(200)
      .expect({ ...created.body, level: 'intermediate' });
    await api
      .delete('/courses/' + id)
      .expect(200)
      .expect({ ...created.body, level: 'intermediate' });
    await app.close();
    await open();
    await api.get('/courses/' + id).expect(404);
    await api
      .patch('/courses/' + id)
      .send({ title: 'No recrear' })
      .expect(404);
    await api.delete('/courses/' + id).expect(404);
    await api.get('/courses/no-numero').expect(400);
    const remaining = await api.get('/courses').expect(200);
    assert.equal(remaining.body.length, 2);
  } finally {
    try {
      await app?.close();
    } finally {
      await database.cleanup();
    }
  }
});
