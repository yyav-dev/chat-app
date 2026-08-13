import { userRepository } from "../repositories";
import { getOnlineUsers } from "../config/redis";
import Boom from "@hapi/boom";

export class UserService {

  async getProfile(userId: string) {

    const user = await userRepository.findById(
      userId
    );

    if (!user) {
      throw Boom.notFound(
        "User not found"
      );
    }

    const {
      password,
      ...userData
    } = user;

    return userData;
  }


  async getUsers(currentUserId: string) {

    const users =
      await userRepository.findAllExcept(
        currentUserId
      );

    const userIds = users.map((u) => u.id);
    const onlineUserIds = await getOnlineUsers(userIds);
    const onlineSet = new Set(onlineUserIds);

    return users.map((user) => {

      const {
        password,
        ...userData
      } = user;

      return {
        ...userData,
        isOnline: onlineSet.has(user.id) || Boolean(user.isOnline),
      };

    });
  }

}


export const userService =
  new UserService();