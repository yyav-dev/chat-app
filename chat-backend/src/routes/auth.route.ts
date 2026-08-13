import { Server } from "@hapi/hapi";
import { authController } from "../controllers";

export const registerAuthRoutes = (
  server: Server
) => {

  server.route([
    {
      method: "POST",
      path: "/api/v1/auth/register",
      options: {
        auth: false,
      },

      handler: authController.register.bind(authController),
    },
    {
      method: "POST",
      path: "/api/v1/auth/login",
      options: {
        auth: false,
      },

      handler: authController.login.bind(authController),
    },
  ]);

};