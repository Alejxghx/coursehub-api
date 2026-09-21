import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StudentsService } from '../students/students.service.js';
import { CoursesService } from '../courses/courses.service.js';
import type { CreateEnrollmentDto } from './dto/create-enrollment.dto.js';

type Enrollment = { id: number; studentId: number; courseId: number };

@Injectable()
export class EnrollmentsService {
  private readonly enrollments: Enrollment[] = [];
  private nextId = 1;

  constructor(
    private readonly studentsService: StudentsService,
    private readonly coursesService: CoursesService,
  ) {}

  create(input: CreateEnrollmentDto): Enrollment {
    const student = this.studentsService.findOne(input.studentId);
    this.requireCourse(input.courseId);
    if (!student.isActive) {
      throw new ConflictException(
        'No se puede matricular a un estudiante inactivo',
      );
    }
    if (
      this.enrollments.some(
        (item) =>
          item.studentId === input.studentId &&
          item.courseId === input.courseId,
      )
    ) {
      throw new ConflictException(
        'El estudiante ya está matriculado en este curso',
      );
    }
    const enrollment = {
      id: this.nextId++,
      studentId: input.studentId,
      courseId: input.courseId,
    };
    this.enrollments.push(enrollment);
    return enrollment;
  }

  findAll(studentId?: number, courseId?: number): Enrollment[] {
    return this.enrollments.filter(
      (item) =>
        (studentId === undefined || item.studentId === studentId) &&
        (courseId === undefined || item.courseId === courseId),
    );
  }

  findByStudent(studentId: number): Enrollment[] {
    this.studentsService.findOne(studentId);
    return this.findAll(studentId);
  }

  findByCourse(courseId: number): Enrollment[] {
    this.requireCourse(courseId);
    return this.findAll(undefined, courseId);
  }

  remove(id: number): void {
    const index = this.enrollments.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new NotFoundException(`No existe la matrícula ${id}`);
    }
    this.enrollments.splice(index, 1);
  }

  private requireCourse(courseId: number): void {
    if (!this.coursesService.findOne(courseId)) {
      throw new NotFoundException(`No existe el curso ${courseId}`);
    }
  }
}
