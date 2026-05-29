import {
  PipeTransform,
  Injectable,
  BadRequestException,
} from "@nestjs/common";
import { z, ZodSchema } from "zod";

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(result.error.errors);
    }
    return result.data;
  }
}

export function createZodDto(schema: ZodSchema) {
  return class ZodDto {
    static schema = schema;
  };
}
