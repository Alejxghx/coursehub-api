import { ConfigService } from '@nestjs/config';
import { databaseConfig } from './database.config.js';
import { validateEnvironment } from './environment.js';

const local = {
  DATABASE_HOST: 'localhost',
  DATABASE_NAME: 'coursehub_test',
  DATABASE_USER: 'example_user',
  DATABASE_PASSWORD: 'example-password-only',
};

describe('Configuración por ambientes', () => {
  it('convierte puertos y aplica valores predeterminados', () => {
    const config = validateEnvironment({ ...local, PORT: '3100' });
    expect(config).toMatchObject({
      PORT: 3100,
      DATABASE_PORT: 5432,
      NODE_ENV: 'development',
    });
  });

  it.each([
    'DATABASE_HOST',
    'DATABASE_NAME',
    'DATABASE_USER',
    'DATABASE_PASSWORD',
  ])('rechaza la ausencia de %s', (key) => {
    const input: Record<string, unknown> = { ...local };
    delete input[key];
    expect(() => validateEnvironment(input)).toThrow(key);
  });

  it.each([
    { DATABASE_PORT: 'not-a-number' },
    { PORT: 65536 },
    { PORT: 0 },
    { NODE_ENV: 'staging' },
  ])('rechaza configuración inválida: %o', (invalid) => {
    expect(() => validateEnvironment({ ...local, ...invalid })).toThrow(
      'Configuración inválida',
    );
  });

  it.each(['', '   '])('exige contraseña en producción', (password) => {
    expect(() =>
      validateEnvironment({
        ...local,
        NODE_ENV: 'production',
        DATABASE_PASSWORD: password,
      }),
    ).toThrow('DATABASE_PASSWORD');
  });

  it('permite contraseña vacía en desarrollo local', () => {
    expect(
      validateEnvironment({ ...local, DATABASE_PASSWORD: '' })
        .DATABASE_PASSWORD,
    ).toBe('');
  });

  it('no incluye valores rechazados ni contraseñas en el error', () => {
    const secret = 'private-value-do-not-log';
    try {
      validateEnvironment({
        ...local,
        NODE_ENV: secret,
        DATABASE_PASSWORD: secret,
      });
      throw new Error('La validación debió fallar');
    } catch (error) {
      expect((error as Error).message).toContain('NODE_ENV');
      expect((error as Error).message).not.toContain(secret);
    }
  });

  it.each([
    ['development', true],
    ['test', false],
    ['production', false],
  ])('synchronize para %s es %s', (environment, synchronize) => {
    const values = validateEnvironment({ ...local, NODE_ENV: environment });
    const options = databaseConfig(new ConfigService(values));
    expect(options.synchronize).toBe(synchronize);
    expect(options).toMatchObject({
      type: 'postgres',
      port: 5432,
      autoLoadEntities: true,
    });
  });
});
