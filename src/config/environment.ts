import Joi from 'joi';

export const environmentSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().min(1).default(3000),
  DATABASE_HOST: Joi.string().trim().required(),
  DATABASE_PORT: Joi.number().port().min(1).default(5432),
  DATABASE_NAME: Joi.string().trim().required(),
  DATABASE_USER: Joi.string().trim().required(),
  DATABASE_PASSWORD: Joi.when('NODE_ENV', {
    is: 'production',
    // Joi uses `then` to describe the conditional schema, not a Promise.
    // oxlint-disable-next-line unicorn/no-thenable
    then: Joi.string().pattern(/\S/).required(),
    otherwise: Joi.string().allow('').required(),
  }),
});

export function validateEnvironment(environment: Record<string, unknown>) {
  const { value, error } = environmentSchema.validate(environment, {
    abortEarly: false,
    allowUnknown: true,
    convert: true,
  });
  if (error) {
    // Report variable names and rules, never rejected values or credentials.
    const problems = error.details.map(
      (detail) => `${detail.path.join('.')}: ${detail.type}`,
    );
    throw new Error(`Configuración inválida: ${problems.join('; ')}`);
  }
  return value as Record<string, unknown>;
}
