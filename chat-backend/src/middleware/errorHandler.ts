import type { Request, ResponseToolkit } from "@hapi/hapi";
import { logger } from "../utils/logger";
import { AppError } from "../utils/appError";


export const errorHandler = (
  request: Request,
  h: ResponseToolkit
) => {

  try {

    return h.continue;

  } catch(error) {

    const err =
      error instanceof AppError
        ? error
        : new AppError(
            "Internal Server Error",
            500
          );


    logger.error({
      message: err.message,
      stack: err.stack,
      path: request.path,
    });


    return h
      .response({
        success: false,
        message: err.message,
      })
      .code(err.statusCode);
  }
};