import dotenv from "dotenv";
import "./../utils/validateEnv";
dotenv.config();
export const env =  {
    port: Number(process.env.PORT) || 3000,
    nodeEnv: process.env.NODE_ENV || "development",

    databaseUrl: process.env.DATABASE_URL || "",
    
    redisHost: process.env.REDIS_HOST || "localhost",
    redisPort: Number(process.env.REDIS_PORT) || 6379,

    jwtSecret: process.env.JWT_SECRET || "",
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",

};