import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class EnrollmentIdPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
      throw new BadRequestException(
        'El identificador debe ser un entero positivo válido',
      );
    }
    return Number(value);
  }
}
