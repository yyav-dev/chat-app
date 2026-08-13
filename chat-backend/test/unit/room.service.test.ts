import { describe, expect, it } from "bun:test";
import { roomService } from "../../src/services/room.service";

describe("RoomService Unit Tests", () => {
  let createdRoomId = "";

  it("should create a new channel room dynamically with slugified ID", async () => {
    const channelName = `Engineering Updates ${Date.now()}`;
    const newRoom = await roomService.createRoom({
      name: channelName,
      description: "Engineering team channel",
    });

    expect(newRoom).toBeDefined();
    expect(newRoom.name).toBe(channelName);
    expect(newRoom.type).toBe("channel");
    expect(newRoom.id).toBeTruthy();
    createdRoomId = newRoom.id;
  });

  it("should update room name and description", async () => {
    const updatedName = `Engineering Renamed ${Date.now()}`;
    const updated = await roomService.updateRoom(createdRoomId, {
      name: updatedName,
      description: "Updated description",
    });

    expect(updated).toBeDefined();
    expect(updated?.name).toBe(updatedName);
    expect(updated?.description).toBe("Updated description");
  });

  it("should fetch all created channel rooms", async () => {
    const rooms = await roomService.getRooms();
    expect(Array.isArray(rooms)).toBe(true);
    expect(rooms.some((r) => r.id === createdRoomId)).toBe(true);
  });

  it("should delete a channel room cleanly", async () => {
    const deleted = await roomService.deleteRoom(createdRoomId);
    expect(deleted).toBeDefined();
    expect(deleted?.id).toBe(createdRoomId);

    const roomsAfter = await roomService.getRooms();
    expect(roomsAfter.some((r) => r.id === createdRoomId)).toBe(false);
  });

  it("should retrieve room history via cache or database fallback", async () => {
    const history = await roomService.getRoomHistory("non-existent-room-999");
    expect(Array.isArray(history)).toBe(true);
  });
});
