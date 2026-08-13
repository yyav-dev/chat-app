import jwt, {
  type JwtPayload,
  type Secret,
  type SignOptions,
} from "jsonwebtoken";
import { env } from "../config/env";

export interface TokenPayload extends JwtPayload {
  userId: string;
  email: string;
}

const JWT_SECRET: Secret = env.jwtSecret;

const JWT_OPTIONS: SignOptions = {
  expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
};

export const generateToken = (
  userId: string,
  email: string
): string => {
  return jwt.sign(
    {
      userId,
      email,
    },
    JWT_SECRET,
    JWT_OPTIONS
  );
};

export const verifyToken = (
  token: string
): TokenPayload => {
  return jwt.verify(
    token,
    JWT_SECRET
  ) as TokenPayload;
};

export const decodeToken = (
  token: string
): TokenPayload | null => {
  return jwt.decode(token) as TokenPayload | null;
};