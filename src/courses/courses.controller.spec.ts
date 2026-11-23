import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { Test, type TestingModule } from '@nestjs/testing';
import { CoursesController } from './courses.controller.js';
import { CoursesService } from './courses.service.js';
import { UpdateCourseUseCase } from './application/update-course.use-case.js';
import {
  CourseNotFoundError,
  CoursePermissionError,
} from './domain/course.errors.js';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.type.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { UserRole } from '../users/user-role.enum.js';
import { CoursesQueryDto } from './dto/courses-query.dto.js';
import { Course } from './entities/course.entity.js';

describe('CoursesController · delegación sin HTTP', () => {
  let module: TestingModule;
  let controller: CoursesController;
  let updateCourse: jest.Mocked<Pick<UpdateCourseUseCase, 'execute'>>;
  let courses: jest.Mocked<
    Pick<CoursesService, 'findAll' | 'findOne' | 'create' | 'remove'>
  >;
  const actor: AuthenticatedUser = Object.freeze({
    id: 4,
    email: 'teacher@example.com',
    role: UserRole.TEACHER,
  });
  const saved = Object.assign(new Course(), {
    id: 7,
    title: 'NestJS',
    level: 'beginner',
    createdByUserId: 4,
  });

  beforeEach(async () => {
    updateCourse = { execute: jest.fn<UpdateCourseUseCase['execute']>() };
    courses = {
      findAll: jest.fn<CoursesService['findAll']>(),
      findOne: jest.fn<CoursesService['findOne']>(),
      create: jest.fn<CoursesService['create']>(),
      remove: jest.fn<CoursesService['remove']>(),
    };
    module = await Test.createTestingModule({
      controllers: [CoursesController],
      providers: [
        { provide: CoursesService, useValue: courses },
        { provide: UpdateCourseUseCase, useValue: updateCourse },
      ],
    })
      // Se invocan métodos directamente; el pipeline HTTP se comprueba por separado.
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(CoursesController);
  });

  afterEach(async () => {
    await module?.close();
  });

  it('delega el id, el DTO y la misma identidad autenticada al caso de uso', async () => {
    // Arrange
    const dto = Object.freeze({ title: 'NestJS avanzado' });
    const result = { ...saved, ...dto };
    updateCourse.execute.mockResolvedValue(result);

    // Act
    const response = await controller.update(7, dto, actor);

    // Assert
    expect(response).toBe(result);
    expect(updateCourse.execute).toHaveBeenCalledTimes(1);
    expect(updateCourse.execute).toHaveBeenCalledWith(7, dto, actor);
    expect(updateCourse.execute.mock.calls[0][1]).toBe(dto);
    expect(updateCourse.execute.mock.calls[0][2]).toBe(actor);
    expect(courses.create).not.toHaveBeenCalled();
    expect(courses.remove).not.toHaveBeenCalled();
  });

  it.each([
    ['permiso rechazado', new CoursePermissionError()],
    ['curso inexistente', new CourseNotFoundError()],
    ['fallo inesperado', new Error('Fallo controlado del caso de uso')],
  ])('propaga %s sin convertirlo en un falso éxito', async (_name, error) => {
    const dto = { title: 'Cambio' };
    updateCourse.execute.mockRejectedValue(error);

    await expect(controller.update(7, dto, actor)).rejects.toBe(error);
    expect(updateCourse.execute).toHaveBeenCalledTimes(1);
    expect(updateCourse.execute).toHaveBeenCalledWith(7, dto, actor);
  });

  it('delega los filtros y la paginación sin modificarlos', async () => {
    const query = Object.assign(new CoursesQueryDto(), { page: 2, limit: 5 });
    const page = {
      items: [],
      meta: { total: 0, page: 2, limit: 5, totalPages: 0 },
    };
    courses.findAll.mockResolvedValue(page);

    expect(await controller.findAll(query)).toBe(page);
    expect(courses.findAll).toHaveBeenCalledTimes(1);
    expect(courses.findAll).toHaveBeenCalledWith(query);
    expect(courses.findAll.mock.calls[0][0]).toBe(query);
  });

  it('delega el identificador de consulta al servicio', async () => {
    courses.findOne.mockResolvedValue(saved);

    expect(await controller.findOne(7)).toBe(saved);
    expect(courses.findOne).toHaveBeenCalledTimes(1);
    expect(courses.findOne).toHaveBeenCalledWith(7);
  });

  it('delega el DTO y la identidad de creación al servicio', async () => {
    const dto = { title: 'NestJS', level: 'beginner' };
    courses.create.mockResolvedValue(saved);

    expect(await controller.create(dto, actor)).toBe(saved);
    expect(courses.create).toHaveBeenCalledTimes(1);
    expect(courses.create).toHaveBeenCalledWith(dto, actor);
  });

  it('delega la eliminación con el id y la identidad del administrador', async () => {
    const admin = { ...actor, role: UserRole.ADMIN };
    courses.remove.mockResolvedValue(saved);

    expect(await controller.remove(7, admin)).toBe(saved);
    expect(courses.remove).toHaveBeenCalledTimes(1);
    expect(courses.remove).toHaveBeenCalledWith(7, admin);
  });
});
