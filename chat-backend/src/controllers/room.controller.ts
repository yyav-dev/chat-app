import type { Request, ResponseToolkit } from "@hapi/hapi";
import Boom from "@hapi/boom";
import { roomService } from "../services/room.service";
import { getSocketServer } from "../config/socket";

export class RoomController {
  async getRooms(request: Request, h: ResponseToolkit) {
    const rooms = await roomService.getRooms();
    return h.response({
      success: true,
      data: rooms,
    });
  }

  async getRoomHistory(request: Request, h: ResponseToolkit) {
    const { roomId } = request.params;
    if (!roomId) {
      throw Boom.badRequest("roomId is required");
    }

    const messages = await roomService.getRoomHistory(roomId);
    return h.response({
      success: true,
      data: messages,
    });
  }

  async createRoom(request: Request, h: ResponseToolkit) {
    const credentials = request.auth.credentials as { userId?: string } | undefined;
    const payload = request.payload as { name: string; description?: string; type?: string };

    if (!payload?.name) {
      throw Boom.badRequest("Room name is required");
    }

    const room = await roomService.createRoom({
      name: payload.name,
      description: payload.description,
      type: payload.type || "channel",
      createdBy: credentials?.userId,
    });

    const io = getSocketServer();
    if (io) {
      io.emit("room:created", room);
    }

    return h.response({
      success: true,
      data: room,
    }).code(201);
  }

  async updateRoom(request: Request, h: ResponseToolkit) {
    const { roomId } = request.params;
    const payload = request.payload as { name?: string; description?: string };

    if (!roomId) {
      throw Boom.badRequest("roomId is required");
    }

    if (!payload?.name?.trim()) {
      throw Boom.badRequest("Room name is required");
    }

    const updated = await roomService.updateRoom(roomId, {
      name: payload.name.trim(),
      description: payload.description,
    });

    if (!updated) {
      throw Boom.notFound("Room not found");
    }

    const io = getSocketServer();
    if (io) {
      io.emit("room:updated", updated);
    }

    return h.response({
      success: true,
      data: updated,
    });
  }

  async deleteRoom(request: Request, h: ResponseToolkit) {
    const { roomId } = request.params;
    if (!roomId) {
      throw Boom.badRequest("roomId is required");
    }

    const deleted = await roomService.deleteRoom(roomId);
    if (!deleted) {
      throw Boom.notFound("Room not found");
    }

    const io = getSocketServer();
    if (io) {
      io.emit("room:deleted", { roomId });
    }

    return h.response({
      success: true,
      data: { roomId },
      message: "Room deleted successfully",
    });
  }
}

export const roomController = new RoomController();
