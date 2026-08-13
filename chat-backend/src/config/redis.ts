import Redis from "ioredis";
import { env } from "./env";
import { logger } from "../utils/logger";

export const redis = new Redis({
  host: env.redisHost,
  port: env.redisPort,
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  enableOfflineQueue: false,
});

// In-memory fallbacks when Redis is offline
const fallbackOnlineUsers = new Map<string, string>();
const fallbackSessionCache = new Map<string, unknown[]>();
const fallbackTypingUsers = new Map<string, Map<string, { userName: string; expiresAt: number }>>();
const fallbackUserSessions = new Map<string, unknown>();
const fallbackRoomMetadata = new Map<string, unknown>();

redis.on("error", (error) => {
  logger.warn(`Redis error: ${error instanceof Error ? error.message : String(error)}`);
});

let isConnecting = false;

export const connectRedis = async () => {
  if (redis.status === "ready") {
    return true;
  }

  if (redis.status === "connecting" || redis.status === "reconnecting" || isConnecting) {
    return false;
  }

  isConnecting = true;
  try {
    await redis.connect();
    logger.info("Redis Connected");
    isConnecting = false;
    return true;
  } catch (error) {
    isConnecting = false;
    logger.warn(
      `Redis unavailable, continuing with in-memory fallbacks: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
};

// 1. User Presence & Heartbeat
export const setUserOnline = async (userId: string, socketId: string, ttlSeconds = 300) => {
  fallbackOnlineUsers.set(userId, socketId);

  const connected = await connectRedis();
  if (!connected) {
    return;
  }

  try {
    const key = `presence:${userId}`;
    await redis.set(key, socketId, "EX", ttlSeconds);
  } catch (err) {
    logger.warn(`Redis setUserOnline error: ${err}`);
  }
};

export const touchUserPresence = async (userId: string, socketId?: string, ttlSeconds = 300) => {
  const currentSocketId = socketId || fallbackOnlineUsers.get(userId) || "online";
  fallbackOnlineUsers.set(userId, currentSocketId);

  const connected = await connectRedis();
  if (!connected) {
    return;
  }

  try {
    const key = `presence:${userId}`;
    await redis.set(key, currentSocketId, "EX", ttlSeconds);
  } catch (err) {
    logger.warn(`Redis touchUserPresence error: ${err}`);
  }
};

export const setUserOffline = async (userId: string) => {
  fallbackOnlineUsers.delete(userId);

  const connected = await connectRedis();
  if (!connected) {
    return;
  }

  try {
    await redis.del(`presence:${userId}`);
  } catch (err) {
    logger.warn(`Redis setUserOffline error: ${err}`);
  }
};

export const getOnlineUsers = async (userIds: string[]) => {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];

  if (uniqueUserIds.length === 0) {
    return [];
  }

  const connected = await connectRedis();
  if (!connected) {
    return uniqueUserIds.filter((userId) => fallbackOnlineUsers.has(userId));
  }

  try {
    const keys = uniqueUserIds.map((id) => `presence:${id}`);
    const results = await redis.mget(...keys);
    const onlineUsers: string[] = [];

    uniqueUserIds.forEach((userId, index) => {
      if (results[index] || fallbackOnlineUsers.has(userId)) {
        onlineUsers.push(userId);
      }
    });

    return onlineUsers;
  } catch (error) {
    logger.warn(`Redis getOnlineUsers error: ${error instanceof Error ? error.message : String(error)}`);
    return uniqueUserIds.filter((userId) => fallbackOnlineUsers.has(userId));
  }
};

// 2. Real-time Typing Indicators
export const setUserTyping = async (
  roomId: string,
  userId: string,
  userName: string,
  ttlSeconds = 3
) => {
  if (!fallbackTypingUsers.has(roomId)) {
    fallbackTypingUsers.set(roomId, new Map());
  }
  fallbackTypingUsers.get(roomId)!.set(userId, {
    userName,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });

  const connected = await connectRedis();
  if (!connected) {
    return;
  }

  try {
    const key = `room:${roomId}:typing:${userId}`;
    await redis.set(key, userName, "EX", ttlSeconds);
  } catch (err) {
    logger.warn(`Redis setUserTyping error: ${err}`);
  }
};

export const removeUserTyping = async (roomId: string, userId: string) => {
  if (fallbackTypingUsers.has(roomId)) {
    fallbackTypingUsers.get(roomId)!.delete(userId);
  }

  const connected = await connectRedis();
  if (!connected) {
    return;
  }

  try {
    const key = `room:${roomId}:typing:${userId}`;
    await redis.del(key);
  } catch (err) {
    logger.warn(`Redis removeUserTyping error: ${err}`);
  }
};

export const getRoomTypingUsers = async (
  roomId: string
): Promise<{ userId: string; userName: string }[]> => {
  const connected = await connectRedis();
  if (!connected) {
    const roomMap = fallbackTypingUsers.get(roomId);
    if (!roomMap) return [];
    const now = Date.now();
    const active: { userId: string; userName: string }[] = [];
    for (const [uid, data] of roomMap.entries()) {
      if (data.expiresAt > now) {
        active.push({ userId: uid, userName: data.userName });
      } else {
        roomMap.delete(uid);
      }
    }
    return active;
  }

  try {
    const pattern = `room:${roomId}:typing:*`;
    const keys = await redis.keys(pattern);
    if (keys.length === 0) {
      return [];
    }

    const values = await redis.mget(...keys);
    const typingList: { userId: string; userName: string }[] = [];

    keys.forEach((key, idx) => {
      const parts = key.split(":");
      const userId = parts[parts.length - 1];
      const userName = values[idx] || "Someone";
      if (userId) {
        typingList.push({ userId, userName });
      }
    });

    return typingList;
  } catch (err) {
    logger.warn(`Redis getRoomTypingUsers error: ${err}`);
    return [];
  }
};

// 3. User Sessions
export const setUserSession = async (userId: string, data: unknown, ttlSeconds = 86400) => {
  fallbackUserSessions.set(userId, data);

  const connected = await connectRedis();
  if (!connected) {
    return;
  }

  try {
    const key = `user:${userId}:session`;
    await redis.set(key, JSON.stringify(data), "EX", ttlSeconds);
  } catch (err) {
    logger.warn(`Redis setUserSession error: ${err}`);
  }
};

export const getUserSession = async (userId: string) => {
  const connected = await connectRedis();
  if (!connected) {
    return fallbackUserSessions.get(userId) ?? null;
  }

  try {
    const key = `user:${userId}:session`;
    const data = await redis.get(key);
    return data ? JSON.parse(data) : fallbackUserSessions.get(userId) ?? null;
  } catch (err) {
    logger.warn(`Redis getUserSession error: ${err}`);
    return fallbackUserSessions.get(userId) ?? null;
  }
};

export const deleteUserSession = async (userId: string) => {
  fallbackUserSessions.delete(userId);

  const connected = await connectRedis();
  if (!connected) {
    return;
  }

  try {
    await redis.del(`user:${userId}:session`);
  } catch (err) {
    logger.warn(`Redis deleteUserSession error: ${err}`);
  }
};

// 4. Room Metadata & Caching
export const cacheRoomMetadata = async (roomId: string, data: unknown, ttlSeconds = 86400) => {
  fallbackRoomMetadata.set(roomId, data);

  const connected = await connectRedis();
  if (!connected) {
    return;
  }

  try {
    const key = `room:${roomId}:metadata`;
    await redis.set(key, JSON.stringify(data), "EX", ttlSeconds);
  } catch (err) {
    logger.warn(`Redis cacheRoomMetadata error: ${err}`);
  }
};

export const getCachedRoomMetadata = async (roomId: string) => {
  const connected = await connectRedis();
  if (!connected) {
    return fallbackRoomMetadata.get(roomId) ?? null;
  }

  try {
    const key = `room:${roomId}:metadata`;
    const data = await redis.get(key);
    return data ? JSON.parse(data) : fallbackRoomMetadata.get(roomId) ?? null;
  } catch (err) {
    logger.warn(`Redis getCachedRoomMetadata error: ${err}`);
    return fallbackRoomMetadata.get(roomId) ?? null;
  }
};

export const deleteRoomMetadata = async (roomId: string) => {
  fallbackRoomMetadata.delete(roomId);

  const connected = await connectRedis();
  if (!connected) {
    return;
  }

  try {
    await redis.del(`room:${roomId}:metadata`);
  } catch (err) {
    logger.warn(`Redis deleteRoomMetadata error: ${err}`);
  }
};

// 5. Message Session Cache
export const cacheSessionData = async (roomId: string, payload: unknown, ttlSeconds = 86400) => {
  const key = `session:${roomId}`;
  const cachedItems = fallbackSessionCache.get(key) ?? [];
  cachedItems.unshift(payload);
  if (cachedItems.length > 50) {
    cachedItems.length = 50;
  }
  fallbackSessionCache.set(key, cachedItems);

  const connected = await connectRedis();
  if (!connected) {
    return;
  }

  try {
    await redis.lpush(key, JSON.stringify(payload));
    await redis.ltrim(key, 0, 49);
    await redis.expire(key, ttlSeconds);
  } catch (error) {
    logger.warn(`Redis cacheSessionData error: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const cacheSessionDataBatch = async (
  roomId: string,
  messages: unknown[],
  ttlSeconds = 86400
) => {
  if (!messages || messages.length === 0) return;

  const key = `session:${roomId}`;
  const existing = fallbackSessionCache.get(key) ?? [];
  const combined = [...messages.slice().reverse(), ...existing].slice(0, 50);
  fallbackSessionCache.set(key, combined);

  const connected = await connectRedis();
  if (!connected) {
    return;
  }

  try {
    const pipeline = redis.pipeline();
    const serialized = messages.map((m) => JSON.stringify(m));
    pipeline.del(key);
    pipeline.lpush(key, ...serialized.slice().reverse());
    pipeline.ltrim(key, 0, 49);
    pipeline.expire(key, ttlSeconds);
    await pipeline.exec();
  } catch (error) {
    logger.warn(`Redis cacheSessionDataBatch error: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const getCachedSessionData = async (roomId: string): Promise<unknown[]> => {
  const key = `session:${roomId}`;
  const fallbackItems = fallbackSessionCache.get(key) ?? [];

  const connected = await connectRedis();
  if (!connected) {
    return fallbackItems;
  }

  try {
    const values = await redis.lrange(key, 0, 49);
    if (values && values.length > 0) {
      return values.map((value) => JSON.parse(value));
    }
  } catch (error) {
    logger.warn(`Redis getCachedSessionData error: ${error instanceof Error ? error.message : String(error)}`);
  }

  return fallbackItems;
};

export const deleteSessionData = async (roomId: string) => {
  fallbackSessionCache.delete(`session:${roomId}`);

  const connected = await connectRedis();
  if (!connected) {
    return;
  }

  try {
    await redis.del(`session:${roomId}`);
  } catch (error) {
    logger.warn(`Redis deleteSessionData error: ${error instanceof Error ? error.message : String(error)}`);
  }
};
