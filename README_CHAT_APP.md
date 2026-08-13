# Real-time Chat Application Documentation

A scalable, real-time chat application built with **Angular 20**, **Hapi.js**, **Socket.IO**, **Redis**, and **PostgreSQL (Drizzle ORM)**.

---

## 1. System Architecture

```
[ Angular 20 Frontend ] <==== (WebSocket / Polling) ====> [ Socket.IO & Hapi Backend ]
                                                                ||          ||
                                                                ||          ||
                                                     [ Redis TTL Layer ]  [ PostgreSQL DB ]
```

### Key Highlights:
1. **Redis Ephemeral & Caching Layer**:
   - `presence:{userId}`: Online presence with 300s TTL (refreshed via heartbeat).
   - `room:{roomId}:typing:{userId}`: Real-time typing indicators with 3s auto-expiry.
   - `session:{roomId}`: Recent 50 messages cached per room with 24h (86,400s) TTL for instant retrieval.
   - `user:{userId}:session`: User session cache with 24h TTL.
   - `room:{roomId}:metadata`: Room description, name, and type with 24h TTL.
2. **PostgreSQL Permanent Layer**:
   - `users`: User profiles and hashed credentials.
   - `rooms`: Channels and group rooms metadata.
   - `messages`: All conversation messages permanently stored with timestamps and foreign keys.

---

## 2. Redis Data Structures & TTL Management

| Key Pattern | Data Type | TTL (Time-to-Live) | Purpose |
| :--- | :--- | :--- | :--- |
| `presence:{userId}` | `String` (socketId) | **300 seconds (5 min)** | Stores online user status with heartbeat refresh. |
| `room:{roomId}:typing:{userId}` | `String` (userName) | **3 seconds** | Ephemeral typing state that auto-expires if user stops typing. |
| `session:{roomId}` | `List` (JSON strings) | **86,400 seconds (24h)** | High-speed cache of recent 50 messages per room/channel. |
| `user:{userId}:session` | `String` (JSON) | **86,400 seconds (24h)** | Caches user metadata & auth state. |
| `room:{roomId}:metadata` | `String` (JSON) | **86,400 seconds (24h)** | Caches room settings, description, and type. |

---

## 3. Socket.IO Real-time Events

### Connection & Presence Events
- `connected` (Server -> Client): Connection acknowledgment with socketId and user identity.
- `presence:update` (Server -> Broadcast): Emitted when a user comes online (`online`) or goes offline (`offline`).
- `presence:request` (Client -> Server): Requests batch online status for a list of user IDs.
- `presence:response` (Server -> Client): Returns `[{ id: string, online: boolean }]`.
- `presence:heartbeat` (Client -> Server): Refreshes the 300s Redis presence TTL.

### Room & Channel Events
- `join:room` (Client -> Server): Joins a room (e.g. `general` or `room_<id1>_<id2>`). Server returns `room:history`.
- `leave:room` (Client -> Server): Leaves room and cancels typing state.
- `rooms:list` (Client -> Server / Server -> Client): Requests and returns list of channels.
- `room:create` (Client -> Server): Creates a new channel.
- `room:created` (Server -> Broadcast): Notifies all connected clients of newly created channel.

### Messaging & Typing Events
- `message:send` (Client -> Server): `{ roomId, message, senderId, senderName }`
- `message:received` (Server -> Room Broadcast): Delivers real-time message payload to all room members.
- `room:history` (Server -> Client): Returns array of cached recent messages (from Redis or PostgreSQL).
- `typing:start` (Client -> Server): `{ roomId }` -> Sets 3s Redis TTL key and broadcasts `typing:update`.
- `typing:stop` (Client -> Server): `{ roomId }` -> Clears Redis key and broadcasts updated `typing:update`.
- `typing:update` (Server -> Room Broadcast): `{ roomId, typingUsers: [{ userId, userName }] }`.

---

## 4. PostgreSQL Database Schema (Drizzle ORM)

### `users` Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  is_online BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

### `rooms` Table
```sql
CREATE TABLE rooms (
  id VARCHAR(150) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255),
  type VARCHAR(20) DEFAULT 'channel' NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

### `messages` Table
```sql
CREATE TABLE messages (
  id VARCHAR(150) PRIMARY KEY,
  room_id VARCHAR(150) NOT NULL,
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

---

## 5. REST API Endpoints

### Authentication
- `POST /api/v1/auth/register`: Register user `{ name, email, password }`.
- `POST /api/v1/auth/login`: Login user `{ email, password }` -> returns `{ token, user }`.

### Users
- `GET /api/v1/users/me` (Auth required): Returns current logged-in user profile.
- `GET /api/v1/users` (Auth required): Returns all registered users with live online presence status.

### Rooms & Channels
- `GET /api/v1/rooms` (Auth required): Returns list of channels.
- `POST /api/v1/rooms` (Auth required): Create new channel `{ name, description }`.
- `GET /api/v1/rooms/{roomId}/history` (Auth required): Returns message history for a channel.

---

## 6. How to Run Locally

### Prerequisites
- Node.js >= 20 or Bun >= 1.3
- PostgreSQL database running on port 5432
- Redis server running on port 6379

### 1. Backend Setup
```bash
cd chat-backend
# Install dependencies
bun install

# Push database schema
bun run db:push

# Run development server
bun run dev
```
Backend runs on `http://localhost:3000`.

### 2. Frontend Setup
```bash
cd chat-frontend
# Install dependencies
npm install

# Start Angular app
npm start
```
Frontend runs on `http://localhost:4200`.

### 3. Run Automated Integration Tests
```bash
cd chat-backend
bun test/redis-rooms-integration.test.ts
```
