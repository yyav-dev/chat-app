import type { Request, ResponseToolkit } from "@hapi/hapi";
import Boom from "@hapi/boom";
import { userService } from "../services";

export class UserController {

  async profile(
    request: Request,
    h: ResponseToolkit
  ) {

    const credentials = request.auth.credentials as
      | {
          userId?: string;
        }
      | undefined;

    if (!credentials?.userId) {
      throw Boom.unauthorized(
        "Authentication required"
      );
    }

    const user = await userService.getProfile(
      credentials.userId
    );

    return h.response({
      success: true,
      data: user,
    });
  }


  async getUsers(
    request: Request,
    h: ResponseToolkit
  ) {

    const credentials = request.auth.credentials as
      | {
          userId?: string;
        }
      | undefined;

    if (!credentials?.userId) {
      throw Boom.unauthorized(
        "Authentication required"
      );
    }

    const users = await userService.getUsers(
      credentials.userId
    );

    return h.response({
      success: true,
      data: users,
    });
  }

}


export const userController =
  new UserController();