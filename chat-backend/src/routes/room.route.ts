import { Server } from "@hapi/hapi";
import { roomController } from "../controllers/room.controller";

export const registerRoomRoutes = (server: Server) => {
  server.route({
    method: "GET",
    path: "/api/v1/rooms",
    options: {
      auth: "jwt",
    },
    handler: roomController.getRooms.bind(roomController),
  });

  server.route({
    method: "POST",
    path: "/api/v1/rooms",
    options: {
      auth: "jwt",
    },
    handler: roomController.createRoom.bind(roomController),
  });

  server.route({
    method: "GET",
    path: "/api/v1/rooms/{roomId}/history",
    options: {
      auth: "jwt",
    },
    handler: roomController.getRoomHistory.bind(roomController),
  });

  server.route({
    method: "PUT",
    path: "/api/v1/rooms/{roomId}",
    options: {
      auth: "jwt",
    },
    handler: roomController.updateRoom.bind(roomController),
  });

  server.route({
    method: "DELETE",
    path: "/api/v1/rooms/{roomId}",
    options: {
      auth: "jwt",
    },
    handler: roomController.deleteRoom.bind(roomController),
  });
};
