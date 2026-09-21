import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Student } from './student.js';
import type { CreateStudentDto } from './dto/create-student.dto.js';
import type { UpdateStudentDto } from './dto/update-student.dto.js';
import type { FilterStudentsDto } from './dto/filter-students.dto.js';

@Injectable()
export class StudentsService {
  private students: Student[] = [];
  private nextId = 1;

  create(input: CreateStudentDto): Student {
    this.checkEmail(input.email);
    const student: Student = { ...input, id: this.nextId++ };
    this.students.push(student);
    return student;
  }

  findAll(filters: FilterStudentsDto): Student[] {
    return this.students.filter(
      (student) =>
        (filters.career === undefined || student.career === filters.career) &&
        (filters.semester === undefined ||
          student.semester === filters.semester) &&
        (filters.isActive === undefined ||
          student.isActive === filters.isActive),
    );
  }

  findOne(id: number): Student {
    const student = this.students.find((item) => item.id === id);
    if (!student) throw new NotFoundException(`No existe el estudiante ${id}`);
    return student;
  }

  update(id: number, input: UpdateStudentDto): Student {
    const student = this.findOne(id);
    if (input.email !== undefined) this.checkEmail(input.email, id);
    // Copiar únicamente campos permitidos y presentes: el id nunca se modifica.
    if (input.name !== undefined) student.name = input.name;
    if (input.email !== undefined) student.email = input.email;
    if (input.age !== undefined) student.age = input.age;
    if (input.career !== undefined) student.career = input.career;
    if (input.semester !== undefined) student.semester = input.semester;
    if (input.isActive !== undefined) student.isActive = input.isActive;
    return student;
  }

  updateStatus(id: number, isActive: boolean): Student {
    const student = this.findOne(id);
    student.isActive = isActive;
    return student;
  }

  remove(id: number): void {
    const student = this.findOne(id);
    if (!student.isActive) {
      throw new ConflictException(
        'No se puede eliminar un estudiante inactivo',
      );
    }
    this.students = this.students.filter((item) => item.id !== id);
  }

  private checkEmail(email: string, excludedId?: number): void {
    if (
      this.students.some(
        (student) => student.email === email && student.id !== excludedId,
      )
    ) {
      throw new ConflictException(
        'El correo electrónico ya pertenece a otro estudiante',
      );
    }
  }
}
