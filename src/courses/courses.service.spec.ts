import { Test, TestingModule } from '@nestjs/testing';
import { CoursesService } from './courses.service.js';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Course } from './entities/course.entity.js';

describe('CoursesService', () => {
  let service: CoursesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoursesService,
        { provide: getRepositoryToken(Course), useValue: {} },
      ],
    }).compile();

    service = module.get<CoursesService>(CoursesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
