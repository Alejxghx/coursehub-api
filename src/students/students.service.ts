import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { FindOptionsWhere } from 'typeorm';
import { Student } from './entities/student.entity.js';
import type { CreateStudentDto } from './dto/create-student.dto.js';
import type { UpdateStudentDto } from './dto/update-student.dto.js';
import type { FilterStudentsDto } from './dto/filter-students.dto.js';
import { postgresErrorCode } from '../common/postgres-error.js';

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(Student)
    private readonly studentsRepository: Repository<Student>,
  ) {}

  async create(input: CreateStudentDto): Promise<Student> {
    await this.checkEmail(input.email);
    return this.saveStudent(this.studentsRepository.create(input));
  }

  findAll(filters: FilterStudentsDto): Promise<Student[]> {
    const where: FindOptionsWhere<Student> = {};
    if (filters.career !== undefined) where.career = filters.career;
    if (filters.semester !== undefined) where.semester = filters.semester;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    return this.studentsRepository.find({ where, order: { id: 'ASC' } });
  }

  async findOne(id: number): Promise<Student> {
    const student = await this.studentsRepository.findOneBy({ id });
    if (!student) throw new NotFoundException('No existe el estudiante ' + id);
    return student;
  }

  async update(id: number, input: UpdateStudentDto): Promise<Student> {
    const student = await this.findOne(id);
    if (input.email !== undefined) {
      await this.checkEmail(input.email, id);
      student.email = input.email;
    }
    // Los campos omitidos no deben sobrescribir los datos guardados.
    if (input.name !== undefined) student.name = input.name;
    if (input.age !== undefined) student.age = input.age;
    if (input.career !== undefined) student.career = input.career;
    if (input.semester !== undefined) student.semester = input.semester;
    if (input.isActive !== undefined) student.isActive = input.isActive;
    return this.saveStudent(student);
  }

  async updateStatus(id: number, isActive: boolean): Promise<Student> {
    const student = await this.findOne(id);
    student.isActive = isActive;
    return this.saveStudent(student);
  }

  async remove(id: number): Promise<void> {
    const student = await this.findOne(id);
    if (!student.isActive) {
      throw new ConflictException(
        'No se puede eliminar un estudiante inactivo',
      );
    }
    try {
      await this.studentsRepository.remove(student);
    } catch (error) {
      if (postgresErrorCode(error) === '23503') {
        throw new ConflictException(
          'Cancela las matrículas del estudiante antes de eliminarlo',
        );
      }
      throw error;
    }
  }

  private async checkEmail(email: string, excludedId?: number): Promise<void> {
    const existing = await this.studentsRepository.findOneBy({ email });
    if (existing && existing.id !== excludedId) {
      throw new ConflictException(
        'El correo electrónico ya pertenece a otro estudiante',
      );
    }
  }

  private async saveStudent(student: Student): Promise<Student> {
    try {
      return await this.studentsRepository.save(student);
    } catch (error) {
      // La restricción UNIQUE también protege solicitudes simultáneas.
      if (postgresErrorCode(error) === '23505') {
        throw new ConflictException(
          'El correo electrónico ya pertenece a otro estudiante',
        );
      }
      throw error;
    }
  }
}
