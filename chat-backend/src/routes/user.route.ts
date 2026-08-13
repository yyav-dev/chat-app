import { Server } from "@hapi/hapi";
import { userController } from "../controllers/user.controller";

export const registerUserRoutes = (
  server: Server
) => {
  server.route({
    method: "GET",
    path: "/api/v1/users/me",
    options: {
      auth: "jwt",
    },
    handler: userController.profile.bind(userController),
  });
  server.route({
  method: "GET",
  path: "/api/v1/users",
  options: {
    auth: "jwt",
  },
  handler: userController.getUsers.bind(userController),
});
};