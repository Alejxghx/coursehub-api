import 'reflect-metadata';
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { ValidationPipe } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { createTestDatabase } from './database.mjs';
import { Enrollment } from '../dist/enrollments/entities/enrollment.entity.js';
import { Student } from '../dist/students/entities/student.entity.js';

it('sesiones 9 y 10: persistencia, restricciones y flujo completo de entrega', async () => {
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
  const restart = async () => {
    await app.close();
    app = undefined;
    await open();
  };
  try {
    await open();
    const course = (
      await api
        .post('/courses')
        .send({ title: 'Entrega NestJS', level: 'beginner' })
        .expect(201)
    ).body;
    const input = {
      name: 'Ana',
      email: 'persistencia@example.com',
      age: 20,
      career: 'Software',
      semester: 6,
      isActive: true,
    };
    const student = (await api.post('/students').send(input).expect(201)).body;
    const pair = { studentId: student.id, courseId: course.id };
    const enrollment = (await api.post('/enrollments').send(pair).expect(201))
      .body;
    assert.equal(enrollment.student.id, student.id);
    assert.equal(enrollment.course.title, course.title);

    await api
      .patch('/students/' + student.id)
      .send({ semester: 7 })
      .expect(200);
    await restart();
    await api
      .get('/students/' + student.id)
      .expect(200)
      .expect({ ...student, semester: 7 });
    await api
      .get('/students?career=Software&semester=7&isActive=true')
      .expect(200)
      .expect([{ ...student, semester: 7 }]);
    await api.post('/students').send(input).expect(409);
    const persisted = (await api.get('/enrollments').query(pair).expect(200))
      .body;
    assert.equal(persisted.length, 1);
    assert.equal(persisted[0].id, enrollment.id);
    assert.equal(persisted[0].student.semester, 7);
    assert.equal(persisted[0].course.title, course.title);
    await api.post('/enrollments').send(pair).expect(409);

    const inactive = (
      await api
        .post('/students')
        .send({ ...input, email: 'inactivo@example.com', isActive: false })
        .expect(201)
    ).body;
    await api
      .post('/enrollments')
      .send({ ...pair, studentId: inactive.id })
      .expect(400);
    await api.delete('/students/' + inactive.id).expect(409);
    await api.get('/students?isActive=false').expect(200).expect([inactive]);
    for (const filter of [
      { studentId: student.id },
      { courseId: course.id },
      pair,
    ]) {
      const filtered = (await api.get('/enrollments').query(filter).expect(200))
        .body;
      assert.deepEqual(
        filtered.map((item) => item.id),
        [enrollment.id],
      );
    }
    await api.delete('/students/' + student.id).expect(409);
    await api.delete('/courses/' + course.id).expect(409);

    // Bypass del servicio: las restricciones deben existir en PostgreSQL.
    const source = app.get(getDataSourceToken());
    const enrollments = source.getRepository(Enrollment);
    await assert.rejects(
      enrollments.save(
        enrollments.create({
          student: { id: student.id },
          course: { id: course.id },
        }),
      ),
      (e) => e.driverError?.code === '23505',
    );
    await assert.rejects(
      enrollments.save(
        enrollments.create({
          student: { id: 2147483647 },
          course: { id: course.id },
        }),
      ),
      (e) => e.driverError?.code === '23503',
    );
    const students = source.getRepository(Student);
    await assert.rejects(
      students.save(students.create(input)),
      (e) => e.driverError?.code === '23505',
    );

    // Solicitudes simultáneas: una creación y conflictos comprensibles.
    const concurrentStudents = await Promise.all(
      Array.from({ length: 4 }, () =>
        api.post('/students').send({ ...input, email: 'carrera@example.com' }),
      ),
    );
    assert.deepEqual(
      concurrentStudents.map((r) => r.status).sort(),
      [201, 409, 409, 409],
    );
    const newStudent = concurrentStudents.find((r) => r.status === 201).body;
    const concurrentEnrollments = await Promise.all(
      Array.from({ length: 4 }, () =>
        api
          .post('/enrollments')
          .send({ studentId: newStudent.id, courseId: course.id }),
      ),
    );
    assert.deepEqual(
      concurrentEnrollments.map((r) => r.status).sort(),
      [201, 409, 409, 409],
    );
    await api
      .delete(
        '/enrollments/' +
          concurrentEnrollments.find((r) => r.status === 201).body.id,
      )
      .expect(204);

    for (const level of ['beginner', 'intermediate', 'advanced']) {
      await api
        .patch('/courses/' + course.id)
        .send({ level })
        .expect(200)
        .expect({ ...course, level });
    }
    await api
      .patch('/courses/' + course.id)
      .send({ level: 'experto' })
      .expect(400);
    await api
      .delete('/enrollments/' + enrollment.id)
      .expect(204)
      .expect('');
    await restart();
    await api.get('/enrollments').query(pair).expect(200).expect([]);
    await api.delete('/enrollments/' + enrollment.id).expect(404);
    await api.get('/students/' + student.id).expect(200);
    await api.get('/courses/' + course.id).expect(200);
    await api.delete('/students/' + student.id).expect(204);
    await restart();
    await api.get('/students/' + student.id).expect(404);
    await api.delete('/courses/' + course.id).expect(200);
  } finally {
    try {
      await app?.close();
    } finally {
      await database.cleanup();
    }
  }
});
