import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
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

  // Legacy courses have no owner; only admins may update those records.
  @Column({ name: 'created_by_user_id', type: 'int', nullable: true })
  createdByUserId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'created_by_user_id',
    foreignKeyConstraintName: 'fk_courses_created_by_user',
  })
  createdBy: Relation<User>;

  @OneToMany(() => Enrollment, (enrollment) => enrollment.course)
  enrollments: Relation<Enrollment[]>;
}
