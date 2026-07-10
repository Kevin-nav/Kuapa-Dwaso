import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";

interface FastifyReplyLike {
  status(statusCode: number): FastifyReplyLike;
  send(payload: unknown): FastifyReplyLike;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("AllExceptionsFilter");

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReplyLike>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const responseBody = exception.getResponse();
      return response.status(status).send(responseBody);
    }

    if (exception instanceof Error) {
      const message = exception.message;

      // Check if it is a Convex validation / uncaught error
      if (message.includes("Uncaught Error:") || message.includes("ConvexError:")) {
        let cleanMessage = message;
        const match = message.match(/(?:Uncaught Error|ConvexError):\s*([^\n]+)/);
        if (match && match[1]) {
          cleanMessage = match[1].trim();
        }

        this.logger.warn(`Convex validation error translated to 400: ${cleanMessage}`);
        return response.status(HttpStatus.BAD_REQUEST).send({
          statusCode: HttpStatus.BAD_REQUEST,
          message: cleanMessage,
          error: "Bad Request",
        });
      }
    }

    // Default fall-through for unknown exceptions (500 Internal Server Error)
    this.logger.error("Unhandled exception caught:", exception);
    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "Internal server error",
    });
  }
}
