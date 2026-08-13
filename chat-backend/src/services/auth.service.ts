import { userRepository } from "../repositories";
import { hashPassword, comparePassword } from "../utils/password";
import { generateToken } from "../utils/jwt";
import {
  registerSchema,
  loginSchema,
} from "../validators";
import { AppError } from "../utils/appError";

export class AuthService {

  async register(payload: unknown) {
    const data = registerSchema.parse(payload);
    const existingUser = await userRepository.findByEmail(data.email);
    if (existingUser) {
      throw new AppError("Email already exists", 409);
    }
    const hashedPassword = await hashPassword(data.password);
    const user = await userRepository.create({
      name: data.name,
      email: data.email,
      password: hashedPassword,
    });
    if (!user) {
      throw new AppError("Unable to create user", 500);
    }
    const { password, ...userData } = user;

    return userData;
  }
  async login(payload: unknown) {
    
    const data = loginSchema.parse(payload);
    const user = await userRepository.findByEmail(data.email);
    if (!user) {
      throw new AppError("Invalid email or password", 401);
    }
    const isPasswordValid = await comparePassword(
      data.password,
      user.password
    );
    if (!isPasswordValid) {
      throw new AppError("Invalid email or password", 401);
    }
    const token = generateToken(
      user.id,
      user.email
    );
    const { password, ...userData } = user;
    return {
      user: userData,
      token,
    };
  }
}
export const authService = new AuthService();