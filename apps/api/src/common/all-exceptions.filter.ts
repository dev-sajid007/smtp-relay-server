import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { FastifyReply } from "fastify";
import { logger } from "./logger";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : "Internal server error";

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      logger.error({ err: exception }, "Unhandled exception");
    }

    const responseBody = {
      statusCode: status,
      message: typeof message === "string" ? message : (message as any).message,
      timestamp: new Date().toISOString(),
    };

    response.status(status).send(responseBody);
  }
}
