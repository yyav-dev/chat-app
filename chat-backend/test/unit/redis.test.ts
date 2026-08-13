import { describe, expect, it } from "bun:test";
import {
  setUserOnline,
  getOnlineUsers,
  setUserOffline,
  touchUserPresence,
  setUserTyping,
  getRoomTypingUsers,
  removeUserTyping,
  cacheSessionData,
  cacheSessionDataBatch,
  getCachedSessionData,
  cacheRoomMetadata,
  getCachedRoomMetadata,
} from "../../src/config/redis";

describe("Redis & In-Memory Cache Helper Unit Tests", () => {
  const testUserId = "test-user-123";
  const testRoomId = "unit-test-room";

  describe("User Presence & Online Status", () => {
    it("should set user online and retrieve online presence", async () => {
      await setUserOnline(testUserId, "socket_abc_1", 300);
      const onlineUsers = await getOnlineUsers([testUserId, "non-existent-user"]);
      expect(onlineUsers).toContain(testUserId);
      expect(onlineUsers).not.toContain("non-existent-user");
    });

    it("should touch presence to refresh heartbeat", async () => {
      await touchUserPresence(testUserId, "socket_abc_1", 300);
      const onlineUsers = await getOnlineUsers([testUserId]);
      expect(onlineUsers).toContain(testUserId);
    });

    it("should set user offline", async () => {
      await setUserOffline(testUserId);
      const onlineUsers = await getOnlineUsers([testUserId]);
      expect(onlineUsers).not.toContain(testUserId);
    });
  });

  describe("Typing Indicators", () => {
    it("should set and retrieve room typing users", async () => {
      await setUserTyping(testRoomId, testUserId, "Test User", 3);
      const typingUsers = await getRoomTypingUsers(testRoomId);
      expect(typingUsers.some((u) => u.userId === testUserId)).toBe(true);
    });

    it("should remove user from typing list", async () => {
      await removeUserTyping(testRoomId, testUserId);
      const typingUsers = await getRoomTypingUsers(testRoomId);
      expect(typingUsers.some((u) => u.userId === testUserId)).toBe(false);
    });
  });

  describe("Message Session Cache (Single & Batch)", () => {
    it("should cache single message and retrieve it", async () => {
      const msg = { id: "m1", roomId: testRoomId, message: "Hello", createdAt: new Date().toISOString() };
      await cacheSessionData(testRoomId, msg, 86400);
      const history = await getCachedSessionData(testRoomId);
      expect(history.length).toBeGreaterThan(0);
      expect((history[0] as any).id).toBe("m1");
    });

    it("should cache message batch efficiently without errors", async () => {
      const batchRoom = "batch-test-room";
      const messages = [
        { id: "b1", roomId: batchRoom, message: "Msg 1", createdAt: new Date().toISOString() },
        { id: "b2", roomId: batchRoom, message: "Msg 2", createdAt: new Date().toISOString() },
      ];
      await cacheSessionDataBatch(batchRoom, messages, 86400);
      const cached = await getCachedSessionData(batchRoom);
      expect(cached.length).toBe(2);
    });
  });

  describe("Room Metadata Cache", () => {
    it("should cache and retrieve room metadata", async () => {
      const metadata = { id: testRoomId, name: "Unit Test Room", type: "channel" };
      await cacheRoomMetadata(testRoomId, metadata, 86400);
      const cached = await getCachedRoomMetadata(testRoomId);
      expect(cached).toEqual(metadata);
    });
  });
});
