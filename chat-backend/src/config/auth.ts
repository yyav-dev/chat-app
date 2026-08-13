import Hapi from "@hapi/hapi";
import HapiJwt from "@hapi/jwt";
import { env } from "./env";

export const registerJwt = async (
  server: Hapi.Server
) => {
  await server.register(HapiJwt);

  server.auth.strategy("jwt", "jwt", {
    keys: env.jwtSecret,

    verify: {
      aud: false,
      iss: false,
      sub: false,
      nbf: true,
      exp: true,
      maxAgeSec: 86400,
    },

    validate: async (artifacts, request, h) => {
      return {
        isValid: true,
        credentials: {
          userId: artifacts.decoded.payload.userId,
          email: artifacts.decoded.payload.email,
        },
      };
    },
  });

  server.auth.default("jwt");
};