import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { isEmail } from 'class-validator';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service.js';
import type {
  AuthenticatedUser,
  JwtPayload,
} from '../types/jwt-payload.type.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['HS256'],
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(
    payload: JwtPayload & { exp?: number },
  ): Promise<AuthenticatedUser> {
    // Types alone do not validate JSON received inside a signed token.
    if (
      !payload ||
      !Number.isSafeInteger(payload.sub) ||
      payload.sub <= 0 ||
      typeof payload.email !== 'string' ||
      !isEmail(payload.email) ||
      !Number.isSafeInteger(payload.exp)
    ) {
      throw new UnauthorizedException();
    }

    // Do not copy the entire payload, the database entity or its password hash.
    // Read the current role from storage: old JWTs cannot preserve revoked roles.
    const user = await this.users.findById(payload.sub);
    if (!user || user.email !== payload.email)
      throw new UnauthorizedException();
    return { id: user.id, email: user.email, role: user.role };
  }
}
