import 'reflect-metadata';
import assert from 'node:assert/strict';
import { before, after, describe, it } from 'node:test';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getMetadataArgsStorage, QueryFailedError } from 'typeorm';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AuthController } from '../dist/auth/auth.controller.js';
import { AuthService } from '../dist/auth/auth.service.js';
import { UsersService } from '../dist/users/users.service.js';
import { User } from '../dist/users/entities/user.entity.js';

// A repository double isolates HTTP, validation and hashing from PostgreSQL.
// Database constraints themselves still require an integration run on PostgreSQL.
describe('Sesión 15: registro HTTP', () => {
  let app;
  const rows = [];
  const repository = {
    async findOneBy({ email }) {
      const row = rows.find((item) => item.email === email);
      if (!row) return null;
      const { passwordHash: _hash, ...safe } = row;
      return safe;
    },
    create(value) {
      return { ...value };
    },
    async save(value) {
      if (rows.some((row) => row.email === value.email)) {
        throw new QueryFailedError(
          'INSERT',
          [],
          Object.assign(new Error('duplicate'), { code: '23505' }),
        );
      }
      const row = { ...value, id: rows.length + 1, createdAt: new Date() };
      rows.push(row);
      return row;
    },
  };

  before(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        UsersService,
        { provide: getRepositoryToken(User), useValue: repository },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });
  after(async () => {
    await app?.close();
  });

  it('normaliza correo, guarda bcrypt costo 12 y solo devuelve campos seguros', async () => {
    const password = '  Aprendo-nest-2026  ';
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: ' ANA@EXAMPLE.COM ', password })
      .expect(201);
    assert.deepEqual(Object.keys(response.body).sort(), [
      'createdAt',
      'email',
      'id',
    ]);
    assert.equal(response.body.email, 'ana@example.com');
    assert.ok(!Number.isNaN(Date.parse(response.body.createdAt)));
    const stored = rows[0];
    assert.equal(stored.password, undefined);
    assert.notEqual(stored.passwordHash, password);
    assert.equal(bcrypt.getRounds(stored.passwordHash), 12);
    assert.equal(await bcrypt.compare(password, stored.passwordHash), true);
    assert.equal(
      await bcrypt.compare(password.trim(), stored.passwordHash),
      false,
    );
  });

  it('rechaza el mismo correo con otras mayúsculas con 409', async () => {
    const count = rows.length;
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'ANA@example.com', password: 'another-test-password' })
      .expect(409);
    assert.equal(rows.length, count);
    assert.ok(!JSON.stringify(response.body).includes('passwordHash'));
  });

  it('rechaza entradas inválidas sin persistir ni reflejar la contraseña', async () => {
    const cases = [
      { email: 'invalid', password: 'example-password' },
      { email: 'test@example.com', password: '1234567' },
      { email: 'test@example.com' },
      { password: 'example-password' },
      { email: 'test@example.com', password: 'a'.repeat(73) },
      { email: 'test@example.com', password: '🙂'.repeat(19) },
      { email: ['test@example.com'], password: 'example-password' },
      { email: 'test@example.com', password: null },
      {
        email: 'test@example.com',
        password: 'example-password',
        passwordHash: 'injected',
      },
    ];
    const count = rows.length;
    for (const input of cases) {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(input)
        .expect(400);
      if (typeof input.password === 'string') {
        assert.ok(!JSON.stringify(response.body).includes(input.password));
      }
    }
    assert.equal(rows.length, count);
  });

  it('acepta exactamente 72 bytes y conserva una sal distinta por usuario', async () => {
    const password = 'a'.repeat(72);
    for (const email of ['salt-one@example.com', 'salt-two@example.com']) {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password })
        .expect(201);
    }
    assert.notEqual(rows.at(-1).passwordHash, rows.at(-2).passwordHash);
  });

  it('la entidad declara email único y excluye el hash de consultas ordinarias', () => {
    const columns = getMetadataArgsStorage().columns.filter(
      (column) => column.target === User,
    );
    assert.equal(
      columns.find((column) => column.propertyName === 'email').options.unique,
      true,
    );
    const hash = columns.find(
      (column) => column.propertyName === 'passwordHash',
    );
    assert.equal(hash.options.select, false);
    assert.equal(hash.options.name, 'password_hash');
    assert.equal(
      columns.some((column) => column.propertyName === 'password'),
      false,
    );
  });

  it('convierte la colisión UNIQUE de una creación concurrente a 409', async () => {
    const service = new UsersService({
      findOneBy: async () => null,
      create: (input) => input,
      save: async () => {
        throw new QueryFailedError(
          'INSERT',
          [],
          Object.assign(new Error('duplicate'), { code: '23505' }),
        );
      },
    });
    await assert.rejects(
      service.create(' RACE@EXAMPLE.COM ', 'test-hash'),
      (error) => error.getStatus() === 409,
    );
  });
});
