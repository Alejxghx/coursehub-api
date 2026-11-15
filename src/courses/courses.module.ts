import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Course } from './entities/course.entity.js';
import { CoursesController } from './courses.controller.js';
import { CoursesService } from './courses.service.js';
import { AuthModule } from '../auth/auth.module.js';
import {
  COURSE_REPOSITORY,
  type CourseRepository,
} from './domain/course-repository.port.js';
import { TypeOrmCourseRepository } from './infrastructure/typeorm-course.repository.js';
import { UpdateCourseUseCase } from './application/update-course.use-case.js';

@Module({
  imports: [TypeOrmModule.forFeature([Course]), AuthModule],
  controllers: [CoursesController],
  providers: [
    CoursesService,
    { provide: COURSE_REPOSITORY, useClass: TypeOrmCourseRepository },
    {
      provide: UpdateCourseUseCase,
      inject: [COURSE_REPOSITORY],
      useFactory: (repository: CourseRepository) =>
        new UpdateCourseUseCase(repository),
    },
  ],
  exports: [CoursesService],
})
export class CoursesModule {}
