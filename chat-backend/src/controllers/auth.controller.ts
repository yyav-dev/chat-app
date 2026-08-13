import type { Request, ResponseToolkit } from "@hapi/hapi";
import { authService } from "../services";

export class AuthController {
  async register(
    request: Request,
    h: ResponseToolkit
  ) {
    const result = await authService.register(
      request.payload
    );

    return h
      .response({
        success: true,
        message: "User registered successfully.",
        data: result,
      })
      .code(201);
  }

  async login(
    request: Request,
    h: ResponseToolkit
  ) {
    const result = await authService.login(
      request.payload
    );

    return h.response({
      success: true,
      message: "Login successful.",
      data: result,
    });
  }
}

export const authController = new AuthController();