import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { StudentsService } from './students.service.js';
import { CreateStudentDto } from './dto/create-student.dto.js';
import { UpdateStudentDto } from './dto/update-student.dto.js';
import { UpdateStudentStatusDto } from './dto/update-student-status.dto.js';
import { FilterStudentsDto } from './dto/filter-students.dto.js';
import { StudentIdPipe } from './pipes/student-id.pipe.js';

@Controller('students')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post()
  create(@Body() input: CreateStudentDto) {
    return this.studentsService.create(input);
  }

  @Get()
  findAll(
    @Query(new ValidationPipe({ transform: true })) filters: FilterStudentsDto,
  ) {
    return this.studentsService.findAll(filters);
  }

  @Get(':id')
  findOne(@Param('id', StudentIdPipe) id: number) {
    return this.studentsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', StudentIdPipe) id: number,
    @Body() input: UpdateStudentDto,
  ) {
    return this.studentsService.update(id, input);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', StudentIdPipe) id: number,
    @Body() input: UpdateStudentStatusDto,
  ) {
    return this.studentsService.updateStatus(id, input.isActive);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', StudentIdPipe) id: number) {
    this.studentsService.remove(id);
  }
}
