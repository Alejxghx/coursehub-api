import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AuthModule } from '../dist/auth/auth.module.js';
import { User } from '../dist/users/entities/user.entity.js';
import { validateEnvironment } from '../dist/config/environment.js';

describe('Sesión 17: JWT firmado después del login', () => {
  let app;
  let jwt;
  let token;
  let signed = 0;
  let queries = 0;
  const secret = randomBytes(48).toString('hex');
  const credentials = {
    email: 'jwt@example.com',
    password: 'Solo-pruebas-2026',
  };
  const safeUser = {
    id: 17,
    email: credentials.email,
    createdAt: new Date('2026-10-27T12:00:00.000Z'),
  };

  before(async () => {
    const hash = await bcrypt.hash(credentials.password, 12);
    const configuration = validateEnvironment({
      NODE_ENV: 'test',
      DATABASE_HOST: 'localhost',
      DATABASE_NAME: 'unused_repository_double',
      DATABASE_USER: 'test',
      DATABASE_PASSWORD: '',
      JWT_SECRET: secret,
    });
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          skipProcessEnv: true,
          load: [() => configuration],
        }),
        AuthModule,
      ],
    })
      .overrideProvider(getRepositoryToken(User))
      .useValue({
        createQueryBuilder() {
          let email;
          return {
            addSelect() {
              return this;
            },
            where(_condition, parameters) {
              email = parameters.email;
              return this;
            },
            async getOne() {
              queries++;
              return email === credentials.email
                ? { ...safeUser, passwordHash: hash }
                : null;
            },
          };
        },
      })
      .compile();
    jwt = module.get(JwtService);
    const signAsync = jwt.signAsync.bind(jwt);
    jwt.signAsync = async (...args) => {
      signed++;
      return signAsync(...args);
    };
    app = module.createNestApplication({ logger: false });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  after(async () => {
    await app?.close();
  });

  it('login válido devuelve 200, accessToken verificable y usuario seguro', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ ...credentials, email: ' JWT@EXAMPLE.COM ' })
      .expect(200);
    assert.deepEqual(Object.keys(response.body).sort(), [
      'accessToken',
      'user',
    ]);
    assert.deepEqual(response.body.user, {
      ...safeUser,
      createdAt: safeUser.createdAt.toISOString(),
    });
    token = response.body.accessToken;
    assert.equal(token.split('.').length, 3);
    const payload = await jwt.verifyAsync(token, { algorithms: ['HS256'] });
    assert.deepEqual(Object.keys(payload).sort(), [
      'email',
      'exp',
      'iat',
      'sub',
    ]);
    assert.equal(payload.sub, safeUser.id);
    assert.equal(payload.email, safeUser.email);
    assert.equal(payload.exp - payload.iat, 900);
    assert.equal(jwt.decode(token).sub, safeUser.id);
    assert.equal(signed, 1);
  });

  it('password incorrecta y correo inexistente devuelven el mismo 401 sin firmar', async () => {
    const beforeSigning = signed;
    const responses = [];
    for (const input of [
      { ...credentials, password: 'Otra-clave-prueba' },
      { ...credentials, email: 'missing@example.com' },
    ]) {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(input)
        .expect(401);
      assert.equal(Object.hasOwn(response.body, 'accessToken'), false);
      responses.push(response.body);
    }
    assert.deepEqual(responses[0], responses[1]);
    assert.equal(responses[0].message, 'Invalid credentials');
    assert.equal(signed, beforeSigning);
  });

  it('DTO inválido devuelve 400 antes de consultar o firmar', async () => {
    const beforeQueries = queries;
    const beforeSigning = signed;
    for (const input of [
      {},
      { ...credentials, email: 'invalid' },
      { ...credentials, password: 'short' },
      { ...credentials, role: 'admin' },
    ]) {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(input)
        .expect(400);
      assert.equal(Object.hasOwn(response.body, 'accessToken'), false);
    }
    assert.equal(queries, beforeQueries);
    assert.equal(signed, beforeSigning);
  });

  it('modificar el payload invalida la firma aunque decode pueda leerlo', async () => {
    const parts = token.split('.');
    const changed = { ...jwt.decode(token), sub: 999 };
    parts[1] = Buffer.from(JSON.stringify(changed)).toString('base64url');
    const tampered = parts.join('.');
    assert.equal(jwt.decode(tampered).sub, 999);
    await assert.rejects(jwt.verifyAsync(tampered), /invalid signature/);
  });

  it('cambiar el secreto invalida el token anterior', async () => {
    const rotated = new JwtService({ secret: randomBytes(48).toString('hex') });
    await assert.rejects(rotated.verifyAsync(token), /invalid signature/);
  });

  it('un token firmado expira y no se acepta en el instante exp', async () => {
    const short = await jwt.signAsync(
      { sub: safeUser.id, email: safeUser.email },
      { expiresIn: '1s' },
    );
    const payload = jwt.decode(short);
    assert.equal(payload.exp - payload.iat, 1);
    await assert.rejects(
      jwt.verifyAsync(short, { clockTimestamp: payload.exp }),
      (error) => error.name === 'TokenExpiredError',
    );
    // The service's default remains 15m; only this signing call used 1s.
    const normal = jwt.decode(
      await jwt.signAsync({ sub: safeUser.id, email: safeUser.email }),
    );
    assert.equal(normal.exp - normal.iat, 900);
  });
});
