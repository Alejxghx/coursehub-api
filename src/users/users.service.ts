import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { postgresErrorCode } from '../common/postgres-error.js';
import { User } from './entities/user.entity.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
  ) {}

  findByEmail(email: string) {
    return this.usersRepository.findOneBy({
      email: email.trim().toLowerCase(),
    });
  }

  async create(email: string, passwordHash: string): Promise<User> {
    const normalizedEmail = email.trim().toLowerCase();
    if (await this.findByEmail(normalizedEmail)) {
      throw new ConflictException('El correo ya está registrado');
    }
    try {
      return await this.usersRepository.save(
        this.usersRepository.create({ email: normalizedEmail, passwordHash }),
      );
    } catch (error) {
      // The database UNIQUE constraint also protects simultaneous requests.
      if (postgresErrorCode(error) === '23505') {
        throw new ConflictException('El correo ya está registrado');
      }
      throw error;
    }
  }
}
