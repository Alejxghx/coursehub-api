import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { FindOptionsWhere } from 'typeorm';
import { Enrollment } from './entities/enrollment.entity.js';
import { Student } from '../students/entities/student.entity.js';
import { Course } from '../courses/entities/course.entity.js';
import type { CreateEnrollmentDto } from './dto/create-enrollment.dto.js';
import { postgresErrorCode } from '../common/postgres-error.js';

@Injectable()
export class EnrollmentsService {
  constructor(
    @InjectRepository(Enrollment)
    private readonly enrollmentsRepository: Repository<Enrollment>,
    @InjectRepository(Student)
    private readonly studentsRepository: Repository<Student>,
    @InjectRepository(Course)
    private readonly coursesRepository: Repository<Course>,
  ) {}

  async create(input: CreateEnrollmentDto): Promise<Enrollment> {
    const student = await this.requireStudent(input.studentId);
    const course = await this.requireCourse(input.courseId);
    if (!student.isActive) {
      throw new BadRequestException(
        'No se puede matricular a un estudiante inactivo',
      );
    }
    const duplicate = await this.enrollmentsRepository.findOne({
      where: { student: { id: student.id }, course: { id: course.id } },
    });
    if (duplicate) {
      throw new ConflictException(
        'El estudiante ya está matriculado en este curso',
      );
    }
    try {
      return await this.enrollmentsRepository.save(
        this.enrollmentsRepository.create({ student, course }),
      );
    } catch (error) {
      const code = postgresErrorCode(error);
      if (code === '23505') {
        throw new ConflictException(
          'El estudiante ya está matriculado en este curso',
        );
      }
      if (code === '23503') {
        throw new ConflictException(
          'El estudiante o curso ya no está disponible',
        );
      }
      throw error;
    }
  }

  findAll(studentId?: number, courseId?: number): Promise<Enrollment[]> {
    const where: FindOptionsWhere<Enrollment> = {};
    if (studentId !== undefined) where.student = { id: studentId };
    if (courseId !== undefined) where.course = { id: courseId };
    return this.enrollmentsRepository.find({
      where,
      relations: { student: true, course: true },
      order: { id: 'ASC' },
    });
  }

  async findByStudent(studentId: number): Promise<Enrollment[]> {
    await this.requireStudent(studentId);
    return this.findAll(studentId);
  }

  async findByCourse(courseId: number): Promise<Enrollment[]> {
    await this.requireCourse(courseId);
    return this.findAll(undefined, courseId);
  }

  async remove(id: number): Promise<void> {
    const enrollment = await this.enrollmentsRepository.findOneBy({ id });
    if (!enrollment)
      throw new NotFoundException('No existe la matrícula ' + id);
    await this.enrollmentsRepository.remove(enrollment);
  }

  private async requireStudent(id: number): Promise<Student> {
    const student = await this.studentsRepository.findOneBy({ id });
    if (!student) throw new NotFoundException('No existe el estudiante ' + id);
    return student;
  }

  private async requireCourse(id: number): Promise<Course> {
    const course = await this.coursesRepository.findOneBy({ id });
    if (!course) throw new NotFoundException('No existe el curso ' + id);
    return course;
  }
}
