import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppModule } from '../dist/app.module.js';
import { Student } from '../dist/students/entities/student.entity.js';
import { Enrollment } from '../dist/enrollments/entities/enrollment.entity.js';
import { Course } from '../dist/courses/entities/course.entity.js';

export async function createTestDatabase() {
  process.loadEnvFile();
  const options = {
    type: 'postgres',
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    username: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  };
  const schema = 'test_' + randomUUID().replaceAll('-', '');
  const client = new Client({ ...options, user: options.username });
  await client.connect();
  await client.query('CREATE SCHEMA "' + schema + '"');
  return {
    async open() {
      const source = await new DataSource({
        ...options,
        schema,
        entities: [Course, Student, Enrollment],
        synchronize: true,
      }).initialize();
      try {
        const module = await Test.createTestingModule({ imports: [AppModule] })
          .overrideProvider(getDataSourceToken())
          .useValue(source)
          .compile();
        return module.createNestApplication({ logger: false });
      } catch (error) {
        await source.destroy();
        throw error;
      }
    },
    async cleanup() {
      try {
        await client.query('DROP SCHEMA "' + schema + '" CASCADE');
      } finally {
        await client.end();
      }
    },
  };
}

export async function createTestApp({ seedCourses = false } = {}) {
  const database = await createTestDatabase();
  let app;
  try {
    app = await database.open();
    if (seedCourses) {
      await app
        .get(getDataSourceToken())
        .getRepository(Course)
        .save([
          { title: 'NestJS Fundamentals', level: 'beginner' },
          { title: 'NestJS Intermediate', level: 'intermediate' },
          { title: 'NestJS Advanced', level: 'advanced' },
        ]);
    }
    const close = app.close.bind(app);
    app.close = async () => {
      try {
        await close();
      } finally {
        await database.cleanup();
      }
    };
    return app;
  } catch (error) {
    await app?.close();
    await database.cleanup();
    throw error;
  }
}
