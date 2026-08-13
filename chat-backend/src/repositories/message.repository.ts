import { eq, desc } from "drizzle-orm";
import { db } from "../config/database";
import { messages } from "../db/schema/messages";
import { users } from "../db/schema/users";

export class MessageRepository {
  async create(data: typeof messages.$inferInsert) {
    const result = await db.insert(messages).values(data).returning();
    return result[0];
  }

  async findByRoomId(roomId: string, limit = 50) {
    const result = await db
      .select({
        id: messages.id,
        roomId: messages.roomId,
        senderId: messages.senderId,
        message: messages.message,
        createdAt: messages.createdAt,
        senderName: users.name,
        senderEmail: users.email,
      })
      .from(messages)
      .leftJoin(users, eq(messages.senderId, users.id))
      .where(eq(messages.roomId, roomId))
      .orderBy(desc(messages.createdAt))
      .limit(limit);

    // Reverse to chronological order (oldest -> newest)
    return result.reverse().map((msg) => ({
      id: msg.id,
      roomId: msg.roomId,
      senderId: msg.senderId,
      message: msg.message,
      createdAt: msg.createdAt.toISOString(),
      senderName: msg.senderName ?? undefined,
    }));
  }

  async deleteByRoomId(roomId: string) {
    return await db.delete(messages).where(eq(messages.roomId, roomId)).returning();
  }
}

export const messageRepository = new MessageRepository();
