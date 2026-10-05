import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { Enrollment } from '../../enrollments/entities/enrollment.entity.js';

@Entity('courses')
export class Course {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'varchar' })
  level: string;

  @OneToMany(() => Enrollment, (enrollment) => enrollment.course)
  enrollments: Relation<Enrollment[]>;
}
