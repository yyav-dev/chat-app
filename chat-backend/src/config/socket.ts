import { Server as SocketIOServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { redis, connectRedis } from "./redis";
import { logger } from "../utils/logger";
import {
  cacheSessionData,
  cacheSessionDataBatch,
  getCachedSessionData,
  getOnlineUsers,
  setUserOffline,
  setUserOnline,
  touchUserPresence,
  setUserTyping,
  removeUserTyping,
  getRoomTypingUsers,
  cacheRoomMetadata,
} from "./redis";
import { userRepository, roomRepository, messageRepository } from "../repositories";
import { roomService } from "../services/room.service";

let ioInstance: SocketIOServer | null = null;

export const getSocketServer = (): SocketIOServer | null => ioInstance;

export const createSocketServer = async (httpServer: any) => {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });
  ioInstance = io;
  logger.info("Socket.IO Server Started");

  const connected = await connectRedis();
  if (connected) {
    try {
      const pubClient = redis.duplicate();
      const subClient = redis.duplicate();
      await Promise.all([pubClient.connect(), subClient.connect()]);
      io.adapter(createAdapter(pubClient, subClient));
      logger.info("Socket.IO Redis Adapter initialized");
    } catch (adapterErr) {
      logger.warn(
        `Redis adapter failed to connect: ${
          adapterErr instanceof Error ? adapterErr.message : String(adapterErr)
        }`
      );
    }
  }

  io.use(async (socket, next) => {
    const userId =
      socket.handshake.auth?.userId || socket.handshake.query?.userId;
    if (!userId) {
      return next(new Error("Missing userId"));
    }

    socket.data.userId = String(userId);
    const userName = socket.handshake.auth?.userName || socket.handshake.query?.userName;
    if (userName) {
      socket.data.userName = String(userName);
    }

    next();
  });

  io.on("connection", async (socket) => {
    const userId = socket.data.userId as string;

    let userName = socket.data.userName as string;
    if (!userName) {
      const user = await userRepository.findById(userId);
      userName = user?.name || "User";
      socket.data.userName = userName;
    }

    void setUserOnline(userId, socket.id, 300);
    void userRepository.updateOnlineStatus(userId, true);

    socket.join(`user:${userId}`);
    logger.info(`Socket connected: ${socket.id} for user ${userName} (${userId})`);

    socket.emit("connected", {
      socketId: socket.id,
      userId,
      userName,
      status: "connected",
    });

    socket.broadcast.emit("presence:update", {
      userId,
      status: "online",
    });

    // 1. Room Management: Join, Leave, Create, Update, Delete, List
    socket.on("join:room", async (roomId: string) => {
      if (!roomId) return;

      socket.join(roomId);

      let history = await getCachedSessionData(roomId);
      if (!history || history.length === 0) {
        const dbMessages = await messageRepository.findByRoomId(roomId, 50);
        if (dbMessages && dbMessages.length > 0) {
          history = dbMessages;
          void cacheSessionDataBatch(roomId, dbMessages, 86400);
        }
      }

      socket.emit("room:history", { roomId, messages: history || [] });
      logger.info(`Socket ${socket.id} (${userName}) joined room ${roomId}`);
    });

    socket.on("leave:room", async (roomId: string) => {
      if (!roomId) return;
      socket.leave(roomId);
      await removeUserTyping(roomId, userId);
      const typingUsers = await getRoomTypingUsers(roomId);
      socket.to(roomId).emit("typing:update", { roomId, typingUsers });
      logger.info(`Socket ${socket.id} (${userName}) left room ${roomId}`);
    });

    socket.on(
      "room:create",
      async (payload: { name: string; description?: string; type?: string }) => {
        if (!payload?.name) return;

        const slug = payload.name
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");

        const roomId = slug || `room_${Date.now()}`;
        const newRoom = await roomRepository.create({
          id: roomId,
          name: payload.name.trim(),
          description: payload.description?.trim() || null,
          type: payload.type || "channel",
          createdBy: userId,
        });

        await cacheRoomMetadata(roomId, newRoom, 86400);
        io.emit("room:created", newRoom);
        logger.info(`Room created: ${newRoom.name} (${roomId}) by ${userName}`);
      }
    );

    socket.on(
      "room:update",
      async (payload: { roomId: string; name?: string; description?: string }) => {
        if (!payload?.roomId || !payload?.name?.trim()) return;

        const updated = await roomService.updateRoom(payload.roomId, {
          name: payload.name.trim(),
          description: payload.description,
        });

        if (updated) {
          io.emit("room:updated", updated);
          logger.info(`Room updated: ${updated.name} (${payload.roomId}) by ${userName}`);
        }
      }
    );

    socket.on("room:delete", async (payload: { roomId: string }) => {
      if (!payload?.roomId) return;

      await roomService.deleteRoom(payload.roomId);
      io.emit("room:deleted", { roomId: payload.roomId });
      logger.info(`Room deleted: ${payload.roomId} by ${userName}`);
    });

    socket.on("rooms:list", async () => {
      const channels = await roomRepository.findChannels();
      socket.emit("rooms:list", channels);
    });

    // 2. Real-time Messaging
    socket.on(
      "message:send",
      async (payload: {
        id?: string;
        roomId: string;
        message: string;
        senderId?: string;
        senderName?: string;
      }) => {
        if (!payload?.roomId || !payload?.message?.trim()) {
          return;
        }

        const messageId = payload.id || `${Date.now()}-${socket.id}`;
        const trimmedMessage = payload.message.trim();
        const effectiveSenderId = payload.senderId || userId;
        const effectiveSenderName = payload.senderName || userName;

        const messagePayload = {
          id: messageId,
          roomId: payload.roomId,
          senderId: effectiveSenderId,
          senderName: effectiveSenderName,
          message: trimmedMessage,
          createdAt: new Date().toISOString(),
        };

        await removeUserTyping(payload.roomId, userId);
        const typingUsers = await getRoomTypingUsers(payload.roomId);
        socket.to(payload.roomId).emit("typing:update", {
          roomId: payload.roomId,
          typingUsers,
        });

        await cacheSessionData(payload.roomId, messagePayload, 86400);

        void messageRepository
          .create({
            id: messageId,
            roomId: payload.roomId,
            senderId: effectiveSenderId,
            message: trimmedMessage,
          })
          .catch((err) => {
            logger.warn(`Failed to persist message in PostgreSQL: ${err}`);
          });

        io.to(payload.roomId).emit("message:received", messagePayload);
        logger.info(`Message sent to ${payload.roomId} by ${effectiveSenderName}`);
      }
    );

    // 3. Real-time Typing Indicators
    socket.on("typing:start", async (payload: { roomId: string }) => {
      if (!payload?.roomId) return;

      await setUserTyping(payload.roomId, userId, userName, 3);
      const typingUsers = await getRoomTypingUsers(payload.roomId);
      socket.to(payload.roomId).emit("typing:update", {
        roomId: payload.roomId,
        typingUsers,
      });
    });

    socket.on("typing:stop", async (payload: { roomId: string }) => {
      if (!payload?.roomId) return;

      await removeUserTyping(payload.roomId, userId);
      const typingUsers = await getRoomTypingUsers(payload.roomId);
      socket.to(payload.roomId).emit("typing:update", {
        roomId: payload.roomId,
        typingUsers,
      });
    });

    // 4. Presence & Heartbeat
    socket.on("presence:heartbeat", async () => {
      await touchUserPresence(userId, socket.id, 300);
    });

    socket.on("presence:request", async (userIds: string[]) => {
      const targetIds = Array.isArray(userIds) ? userIds : [];
      const onlineUserIds = await getOnlineUsers(targetIds);
      const presencePayload = targetIds.map((id) => ({
        id,
        online: onlineUserIds.includes(id),
      }));
      socket.emit("presence:response", presencePayload);
    });

    // 5. Disconnect
    socket.on("disconnect", async () => {
      await setUserOffline(userId);
      await userRepository.updateOnlineStatus(userId, false);
      logger.info(`Socket disconnected: ${socket.id} for user ${userName} (${userId})`);

      socket.broadcast.emit("presence:update", {
        userId,
        status: "offline",
      });
    });
  });

  return io;
};
