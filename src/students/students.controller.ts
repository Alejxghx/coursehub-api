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
  findOne(@Param('id', StudentIdPipe) id: string) {
    // Keep the raw text until the ID pipe validates its decimal format.
    return this.studentsService.findOne(Number(id));
  }

  @Patch(':id')
  update(
    @Param('id', StudentIdPipe) id: string,
    @Body() input: UpdateStudentDto,
  ) {
    return this.studentsService.update(Number(id), input);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', StudentIdPipe) id: string,
    @Body() input: UpdateStudentStatusDto,
  ) {
    return this.studentsService.updateStatus(Number(id), input.isActive);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', StudentIdPipe) id: string) {
    return this.studentsService.remove(Number(id));
  }
}
