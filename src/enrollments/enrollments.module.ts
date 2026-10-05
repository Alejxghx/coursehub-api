import { Module } from '@nestjs/common';
import { EnrollmentsController } from './enrollments.controller.js';
import { EnrollmentsService } from './enrollments.service.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Student } from '../students/entities/student.entity.js';
import { Course } from '../courses/entities/course.entity.js';
import { Enrollment } from './entities/enrollment.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Enrollment, Student, Course])],
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService],
})
export class EnrollmentsModule {}

// Los repositorios permiten validar las relaciones antes de guardar.
