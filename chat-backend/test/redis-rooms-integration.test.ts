import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { io, Socket } from "socket.io-client";
import { createServer } from "../src/app";
import { redis } from "../src/config/redis";
import { messageRepository } from "../src/repositories/message.repository";
import { roomRepository } from "../src/repositories/room.repository";

describe("Socket.IO, Redis TTL & Message Persistence Integration Suite", () => {
  let server: any;
  let socket1: Socket;
  let socket2: Socket;

  const user1Id = "be8dd248-89af-413b-b868-fec65dba87ee";
  const user2Id = "c093da2e-dc24-4787-8eac-47e67d35575f";
  const testRoomId = `integration-test-room-${Date.now()}`;

  beforeAll(async () => {
    server = await createServer();
    await server.start();

    // Create dynamic channel room
    await roomRepository.create({
      id: testRoomId,
      name: "Integration Test Room",
      description: "Automated test channel",
      type: "channel",
    });

    // 1. Connect Socket 1
    socket1 = io("http://localhost:3000", {
      transports: ["websocket"],
      auth: { userId: user1Id, userName: "Kokila" },
    });

    await new Promise<void>((resolve, reject) => {
      socket1.on("connect", resolve);
      socket1.on("connect_error", reject);
    });

    // 2. Connect Socket 2
    socket2 = io("http://localhost:3000", {
      transports: ["websocket"],
      auth: { userId: user2Id, userName: "Obuli" },
    });

    await new Promise<void>((resolve, reject) => {
      socket2.on("connect", resolve);
      socket2.on("connect_error", reject);
    });
  });

  afterAll(async () => {
    if (socket1) socket1.disconnect();
    if (socket2) socket2.disconnect();
    if (server) await server.stop();
  });

  it("should verify Redis TTL for user presence", async () => {
    const presenceKey = `presence:${user1Id}`;
    const presenceTtl = await redis.ttl(presenceKey);
    expect(presenceTtl).toBeGreaterThan(0);
    expect(presenceTtl).toBeLessThanOrEqual(300);
  });

  it("should allow both sockets to join the dynamic channel room", async () => {
    socket1.emit("join:room", testRoomId);
    socket2.emit("join:room", testRoomId);
    await new Promise((r) => setTimeout(r, 100));
    expect(socket1.connected).toBe(true);
    expect(socket2.connected).toBe(true);
  });

  it("should broadcast typing indicators with TTL", async () => {
    const typingPromise = new Promise<any>((resolve) => {
      socket2.on("typing:update", (data) => {
        if (data.roomId === testRoomId) {
          resolve(data);
        }
      });
    });

    socket1.emit("typing:start", { roomId: testRoomId });
    const typingData = await typingPromise;
    expect(typingData.typingUsers.some((u: any) => u.userId === user1Id)).toBe(true);

    const typingKey = `room:${testRoomId}:typing:${user1Id}`;
    const typingTtl = await redis.ttl(typingKey);
    expect(typingTtl).toBeGreaterThan(0);
    expect(typingTtl).toBeLessThanOrEqual(3);

    socket1.emit("typing:stop", { roomId: testRoomId });
  });

  it("should send and receive real-time messages across room members", async () => {
    const channelMsgText = `Test message at ${Date.now()}`;
    const msgPromise = new Promise<any>((resolve) => {
      socket2.on("message:received", (msg) => {
        if (msg.roomId === testRoomId) {
          resolve(msg);
        }
      });
    });

    socket1.emit("message:send", {
      roomId: testRoomId,
      message: channelMsgText,
      senderId: user1Id,
      senderName: "Kokila",
    });

    const receivedMsg = await msgPromise;
    expect(receivedMsg.message).toBe(channelMsgText);

    // Verify session cache TTL
    const sessionKey = `session:${testRoomId}`;
    const sessionTtl = await redis.ttl(sessionKey);
    expect(sessionTtl).toBeGreaterThan(0);

    // Verify database persistence
    await new Promise((r) => setTimeout(r, 200));
    const dbMessages = await messageRepository.findByRoomId(testRoomId, 10);
    expect(dbMessages.some((m) => m.message === channelMsgText)).toBe(true);
  });

  it("should broadcast room:created when a new channel is created", async () => {
    const newChannelPromise = new Promise<any>((resolve) => {
      socket2.on("room:created", (room) => {
        resolve(room);
      });
    });

    const dynamicChannelName = `Team Alpha ${Date.now()}`;
    socket1.emit("room:create", {
      name: dynamicChannelName,
      description: "Team alpha channel",
    });

    const createdRoom = await newChannelPromise;
    expect(createdRoom.name).toBe(dynamicChannelName);
  });
});
