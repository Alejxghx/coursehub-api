import 'reflect-metadata';
import assert from 'node:assert/strict';
import { it } from 'node:test';
import { ValidationPipe } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { createTestDatabase } from './database.mjs';
import { User } from '../dist/users/entities/user.entity.js';
import { UsersService } from '../dist/users/users.service.js';

it('registro y login con PostgreSQL: hash privado, unicidad y persistencia tras reiniciar', async () => {
  const database = await createTestDatabase();
  let app;
  let api;
  const open = async () => {
    app = await database.open();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    api = request(app.getHttpServer());
  };
  try {
    await open();
    const credentials = {
      email: 'persist-login@example.com',
      password: '  Solo-pruebas-2026  ',
    };
    const registered = (
      await api
        .post('/auth/register')
        .send({ ...credentials, email: ' PERSIST-LOGIN@EXAMPLE.COM ' })
        .expect(201)
    ).body;
    assert.deepEqual(Object.keys(registered).sort(), [
      'createdAt',
      'email',
      'id',
    ]);
    assert.equal(registered.email, credentials.email);

    const repository = app.get(getDataSourceToken()).getRepository(User);
    const ordinary = await repository.findOneByOrFail({ id: registered.id });
    assert.equal(ordinary.passwordHash, undefined);
    const users = app.get(UsersService);
    const withPassword = await users.findByEmailWithPassword(
      ' PERSIST-LOGIN@EXAMPLE.COM ',
    );
    assert.ok(
      await bcrypt.compare(credentials.password, withPassword.passwordHash),
    );
    assert.equal(bcrypt.getRounds(withPassword.passwordHash), 12);
    assert.equal(await users.findByEmailWithPassword("' OR 1=1 --"), null);

    // Bypass the service to verify the database UNIQUE constraint itself.
    await assert.rejects(
      repository.save(
        repository.create({
          email: credentials.email,
          passwordHash: withPassword.passwordHash,
        }),
      ),
      (error) => error.driverError?.code === '23505',
    );
    await api
      .post('/auth/register')
      .send({ ...credentials, email: credentials.email.toUpperCase() })
      .expect(409);

    await app.close();
    app = undefined;
    await open();
    await api
      .post('/auth/login')
      .send(credentials)
      .expect(200)
      .expect((response) => {
        assert.deepEqual(response.body.user, registered);
        assert.equal(typeof response.body.accessToken, 'string');
      });

    const wrongPassword = await api
      .post('/auth/login')
      .send({ ...credentials, password: 'Otra-clave-prueba' })
      .expect(401);
    const missingEmail = await api
      .post('/auth/login')
      .send({ ...credentials, email: 'missing@example.com' })
      .expect(401);
    assert.deepEqual(wrongPassword.body, missingEmail.body);
    assert.deepEqual(wrongPassword.body, {
      statusCode: 401,
      message: 'Invalid credentials',
      error: 'Unauthorized',
    });
    await api
      .post('/auth/login')
      .send({ email: 'invalid', password: credentials.password })
      .expect(400);

    // Concurrent registrations must create exactly one account.
    const concurrent = await Promise.all(
      Array.from({ length: 3 }, () =>
        api.post('/auth/register').send({
          ...credentials,
          email: 'concurrent-login@example.com',
        }),
      ),
    );
    assert.deepEqual(
      concurrent.map((response) => response.status).sort(),
      [201, 409, 409],
    );
    await api
      .post('/auth/login')
      .send({ ...credentials, email: 'concurrent-login@example.com' })
      .expect(200)
      .expect((response) => {
        assert.deepEqual(
          response.body.user,
          concurrent.find((item) => item.status === 201).body,
        );
        assert.equal(typeof response.body.accessToken, 'string');
      });
    assert.equal(
      await app.get(getDataSourceToken()).getRepository(User).count(),
      2,
    );
  } finally {
    try {
      await app?.close();
    } finally {
      await database.cleanup();
    }
  }
});
