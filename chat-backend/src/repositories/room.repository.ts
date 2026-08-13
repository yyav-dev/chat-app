import { eq, desc } from "drizzle-orm";
import { db } from "../config/database";
import { rooms } from "../db/schema/rooms";

export class RoomRepository {
  async findAll() {
    return await db.select().from(rooms).orderBy(desc(rooms.createdAt));
  }

  async findById(id: string) {
    const result = await db
      .select()
      .from(rooms)
      .where(eq(rooms.id, id))
      .limit(1);

    return result[0] ?? null;
  }

  async create(data: typeof rooms.$inferInsert) {
    const result = await db
      .insert(rooms)
      .values(data)
      .onConflictDoNothing()
      .returning();

    return result[0] ?? (await this.findById(data.id));
  }

  async findChannels() {
    return await db
      .select()
      .from(rooms)
      .where(eq(rooms.type, "channel"))
      .orderBy(rooms.name);
  }

  async update(id: string, data: Partial<typeof rooms.$inferInsert>) {
    const result = await db
      .update(rooms)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(rooms.id, id))
      .returning();

    return result[0] ?? null;
  }

  async delete(id: string) {
    const result = await db
      .delete(rooms)
      .where(eq(rooms.id, id))
      .returning();

    return result[0] ?? null;
  }
}

export const roomRepository = new RoomRepository();
