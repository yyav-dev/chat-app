import { eq, ne } from "drizzle-orm";
import { db } from "../config/database";
import { users } from "../db/schema/users";

export class UserRepository {

  async findByEmail(email: string) {

    const result = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return result[0] ?? null;
  }


  async findById(id: string) {

    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return result[0] ?? null;
  }


  async findAllExcept(currentUserId: string) {

    const result = await db
      .select()
      .from(users)
      .where(ne(users.id, currentUserId));

    return result;
  }


  async create(
    data: typeof users.$inferInsert
  ) {

    const result = await db
      .insert(users)
      .values(data)
      .returning();

    return result[0];
  }


  async updateOnlineStatus(
    id: string,
    isOnline: boolean
  ) {

    const result = await db
      .update(users)
      .set({
        isOnline,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    return result[0] ?? null;
  }

}


export const userRepository =
  new UserRepository();