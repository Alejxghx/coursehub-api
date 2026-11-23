import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { UpdateCourseUseCase } from './update-course.use-case.js';
import type { CourseRepository } from '../domain/course-repository.port.js';
import type { CourseRecord } from '../domain/course.js';
import {
  CourseNotFoundError,
  CoursePermissionError,
} from '../domain/course.errors.js';
import type { AuthenticatedUser } from '../../auth/types/jwt-payload.type.js';
import { UserRole } from '../../users/user-role.enum.js';

const actor = (id: number, role: UserRole): AuthenticatedUser => ({
  id,
  role,
  email: 'unit@example.com',
});

describe('UpdateCourseUseCase · reglas de actualización', () => {
  let course: CourseRecord;
  let repository: jest.Mocked<CourseRepository>;
  let useCase: UpdateCourseUseCase;

  beforeEach(() => {
    course = Object.freeze({
      id: 7,
      title: 'NestJS',
      level: 'beginner',
      createdByUserId: 4,
    });
    // Un doble nuevo por prueba, sin PostgreSQL, HTTP ni estado compartido.
    repository = {
      findById: jest
        .fn<CourseRepository['findById']>()
        .mockResolvedValue(course),
      save: jest
        .fn<CourseRepository['save']>()
        .mockImplementation(async (updated) => ({ ...updated })),
    };
    useCase = new UpdateCourseUseCase(repository);
  });

  it('permite al docente propietario actualizar título y nivel sin mutar el original', async () => {
    // Arrange
    const changes = Object.freeze({
      title: 'NestJS avanzado',
      level: 'advanced',
    });
    const owner = actor(4, UserRole.TEACHER);

    // Act
    const result = await useCase.execute(7, changes, owner);

    // Assert
    const expected = { ...course, ...changes };
    expect(result).toEqual(expected);
    expect(repository.findById).toHaveBeenCalledTimes(1);
    expect(repository.findById).toHaveBeenCalledWith(7);
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(repository.save).toHaveBeenCalledWith(expected);
    expect(course).toEqual({
      id: 7,
      title: 'NestJS',
      level: 'beginner',
      createdByUserId: 4,
    });
  });

  it('permite al administrador actualizar un curso de otro docente', async () => {
    const result = await useCase.execute(
      7,
      { title: 'Administrado' },
      actor(99, UserRole.ADMIN),
    );

    expect(result).toEqual({ ...course, title: 'Administrado' });
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(repository.save).toHaveBeenCalledWith(result);
  });

  it('permite al administrador actualizar un curso antiguo sin propietario', async () => {
    repository.findById.mockResolvedValue({ ...course, createdByUserId: null });

    const result = await useCase.execute(
      7,
      { level: 'advanced' },
      actor(99, UserRole.ADMIN),
    );

    expect(result).toEqual({
      ...course,
      level: 'advanced',
      createdByUserId: null,
    });
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(repository.save).toHaveBeenCalledWith(result);
  });

  it.each([
    ['solo título', { title: 'Nuevo' }, { title: 'Nuevo', level: 'beginner' }],
    [
      'solo nivel',
      { level: 'intermediate' },
      { title: 'NestJS', level: 'intermediate' },
    ],
    ['DTO vacío', {}, { title: 'NestJS', level: 'beginner' }],
  ])(
    'conserva los campos omitidos al recibir %s',
    async (_name, changes, fields) => {
      const result = await useCase.execute(
        7,
        changes,
        actor(4, UserRole.TEACHER),
      );

      expect(result).toEqual({ ...course, ...fields });
      expect(repository.save).toHaveBeenCalledTimes(1);
      expect(repository.save).toHaveBeenCalledWith(result);
    },
  );

  it('rechaza un curso inexistente sin intentar guardar', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(404, { title: 'Cambio' }, actor(4, UserRole.TEACHER)),
    ).rejects.toBeInstanceOf(CourseNotFoundError);
    expect(repository.findById).toHaveBeenCalledTimes(1);
    expect(repository.findById).toHaveBeenCalledWith(404);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it.each([
    ['docente ajeno', actor(9, UserRole.TEACHER)],
    ['estudiante con el id del propietario', actor(4, UserRole.STUDENT)],
    ['estudiante ajeno', actor(9, UserRole.STUDENT)],
  ])('rechaza al %s antes de guardar', async (_name, unauthorized) => {
    await expect(
      useCase.execute(7, { title: 'No permitido' }, unauthorized),
    ).rejects.toBeInstanceOf(CoursePermissionError);
    expect(repository.findById).toHaveBeenCalledTimes(1);
    expect(repository.findById).toHaveBeenCalledWith(7);
    expect(repository.save).not.toHaveBeenCalled();
    expect(course.title).toBe('NestJS');
  });

  it('un docente no se apropia de un curso antiguo sin propietario', async () => {
    repository.findById.mockResolvedValue({ ...course, createdByUserId: null });

    await expect(
      useCase.execute(7, { title: 'No permitido' }, actor(4, UserRole.TEACHER)),
    ).rejects.toBeInstanceOf(CoursePermissionError);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('ignora id y propietario inyectados incluso fuera de HTTP', async () => {
    const changes = { title: 'Permitido', id: 99, createdByUserId: 99 };

    const result = await useCase.execute(
      7,
      changes,
      actor(4, UserRole.TEACHER),
    );

    expect(result).toEqual({ ...course, title: 'Permitido' });
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(repository.save).toHaveBeenCalledWith(result);
  });

  it('devuelve el resultado confirmado por el repositorio', async () => {
    const persisted = { ...course, title: 'Título normalizado al guardar' };
    repository.save.mockResolvedValue(persisted);

    const result = await useCase.execute(
      7,
      { title: 'Entrada' },
      actor(4, UserRole.TEACHER),
    );

    expect(repository.save).toHaveBeenCalledTimes(1);

    expect(repository.save).toHaveBeenCalledWith({
      ...course,
      title: 'Entrada',
    });
    expect(result).toBe(persisted);
  });

  it('propaga un fallo de lectura y no guarda', async () => {
    const failure = new Error('Repositorio no disponible');
    repository.findById.mockRejectedValue(failure);

    await expect(
      useCase.execute(7, {}, actor(4, UserRole.TEACHER)),
    ).rejects.toBe(failure);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('propaga un fallo al guardar sin inventar una actualización exitosa', async () => {
    const failure = new Error('No se pudo guardar');
    repository.save.mockRejectedValue(failure);

    await expect(
      useCase.execute(7, { title: 'Cambio' }, actor(4, UserRole.TEACHER)),
    ).rejects.toBe(failure);
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(repository.save).toHaveBeenCalledWith({
      ...course,
      title: 'Cambio',
    });
  });
});
