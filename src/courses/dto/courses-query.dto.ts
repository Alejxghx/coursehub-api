import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const COURSE_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
const COURSE_SORT_FIELDS = ['id', 'title', 'level'] as const;

export class CoursesQueryDto {
  @IsOptional()
  @IsIn(COURSE_LEVELS)
  level?: (typeof COURSE_LEVELS)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 10;

  @IsOptional()
  @IsIn(COURSE_SORT_FIELDS)
  sortBy: (typeof COURSE_SORT_FIELDS)[number] = 'id';

  @IsOptional()
  @Transform(({ value }) => String(value).toUpperCase())
  @IsIn(['ASC', 'DESC'])
  order: 'ASC' | 'DESC' = 'ASC';
}
