import { roomRepository, messageRepository } from "../repositories";
import {
  getCachedSessionData,
  cacheSessionDataBatch,
  cacheRoomMetadata,
  getCachedRoomMetadata,
  deleteRoomMetadata,
  deleteSessionData,
} from "../config/redis";

export class RoomService {
  async getRooms() {
    return await roomRepository.findChannels();
  }

  async getRoomById(id: string) {
    const cached = await getCachedRoomMetadata(id);
    if (cached) return cached;

    const room = await roomRepository.findById(id);
    if (room) {
      await cacheRoomMetadata(id, room, 86400);
    }
    return room;
  }

  async createRoom(data: { name: string; description?: string; type?: string; createdBy?: string }) {
    const slug = data.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const roomId = slug || `room_${Date.now()}`;
    const newRoom = await roomRepository.create({
      id: roomId,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      type: data.type || "channel",
      createdBy: data.createdBy || null,
    });

    await cacheRoomMetadata(roomId, newRoom, 86400);
    return newRoom;
  }

  async updateRoom(id: string, data: { name?: string; description?: string }) {
    const existing = await roomRepository.findById(id);
    if (!existing) {
      return null;
    }

    const updatedRoom = await roomRepository.update(id, {
      ...(data.name ? { name: data.name.trim() } : {}),
      ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
    });

    if (updatedRoom) {
      await cacheRoomMetadata(id, updatedRoom, 86400);
    }
    return updatedRoom;
  }

  async deleteRoom(id: string) {
    const existing = await roomRepository.findById(id);
    if (!existing) {
      return null;
    }

    await messageRepository.deleteByRoomId(id);
    const deletedRoom = await roomRepository.delete(id);

    await deleteRoomMetadata(id);
    await deleteSessionData(id);

    return deletedRoom;
  }

  async getRoomHistory(roomId: string, limit = 50) {
    const cachedHistory = await getCachedSessionData(roomId);
    if (cachedHistory && cachedHistory.length > 0) {
      return cachedHistory;
    }

    const dbMessages = await messageRepository.findByRoomId(roomId, limit);
    if (dbMessages && dbMessages.length > 0) {
      void cacheSessionDataBatch(roomId, dbMessages, 86400);
    }
    return dbMessages || [];
  }
}

export const roomService = new RoomService();
