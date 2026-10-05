import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { Enrollment } from '../../enrollments/entities/enrollment.entity.js';

@Entity('students')
export class Student {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', unique: true })
  email: string;

  @Column({ type: 'int' })
  age: number;

  @Column({ type: 'varchar' })
  career: string;

  @Column({ type: 'int' })
  semester: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => Enrollment, (enrollment) => enrollment.student)
  enrollments: Relation<Enrollment[]>;
}
