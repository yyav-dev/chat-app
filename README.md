# 💬 Real-Time Chat Application

A high-performance, full-stack real-time chat application built with **Angular 21**, **Bun**, **Hapi.js**, **Socket.IO**, **PostgreSQL**, and **Redis**.

---

## ✨ Features

- **⚡ Instant Real-Time Messaging**: Real-time bi-directional messaging with sub-millisecond delivery via Socket.IO.
- **💬 Community Channels & 1-on-1 Direct Messages**: Create, rename, and delete public channels or start private conversations.
- **🟢 Live Online Presence**: Distributed user presence tracking powered by Redis with automatic 60s heartbeats and 300s TTL.
- **✍️ Real-Time Typing Indicators**: Live typing animations with 3s auto-expiring TTL to prevent stuck indicators.
- **🚀 Ultra-Fast Message History**: Dual-layer architecture combining Redis session caching (O(1) pipeline retrieval) with PostgreSQL persistent storage.
- **⚡ Optimistic UI Updates**: Client-side instant message bubbles with unique message IDs and server-side deduplication.
- **🛡️ JWT Authentication**: Stateless token-based security for REST endpoints and WebSocket handshakes.
- **🔄 Fault-Tolerant Failover**: Graceful in-memory fallback structures ensuring uninterrupted operation even if Redis connection fluctuates.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | Angular 21, Tailwind CSS, PrimeNG, RxJS |
| **Backend Runtime** | Bun Runtime |
| **HTTP Framework** | Hapi.js |
| **Real-Time Engine** | Socket.IO + `@socket.io/redis-adapter` |
| **Database** | PostgreSQL |
| **ORM** | Drizzle ORM |
| **Cache & State** | Redis (`ioredis`) |
| **Auth & Security** | JWT (`jsonwebtoken`), Bcrypt password hashing |
| **Testing** | Bun Test (Backend), Vitest (Frontend) |

---

## 🏗️ Architecture Overview

```
                 Angular 21 Frontend
                          │
            REST API + Socket.IO (WSS)
                          │
                 Hapi.js + Bun Server
           ┌──────────────┴──────────────┐
           │                             │
    Socket.IO Gateway               REST APIs
           │                             │
     Chat Engine                    Auth / Users / Rooms
           │                             │
      Redis Cache                   PostgreSQL DB
  (Presence / Typing / History)  (Users / Messages / Rooms)
```

---

## 📁 Project Structure

```text
chat-app/
├── chat-backend/             # Bun + Hapi.js + Socket.IO Backend
│   ├── src/
│   │   ├── config/           # Redis, Socket.IO, DB, and JWT auth config
│   │   ├── controllers/      # Route controllers (Auth, Room, User)
│   │   ├── db/schema/        # Drizzle ORM PostgreSQL schemas
│   │   ├── repositories/     # Database repository layer
│   │   ├── routes/           # REST API route registrations
│   │   ├── services/         # Business logic layer
│   │   └── index.ts          # Server entry point
│   └── test/                 # Automated unit and integration test suites
│
├── chat-frontend/            # Angular 21 + Tailwind CSS Frontend
│   ├── src/app/
│   │   ├── core/             # Services (Socket, Room, User, Token), Guards, Interceptors
│   │   ├── features/auth/    # Login and Register pages
│   │   └── features/chat/    # Chat dashboard, sidebar, message list, user list
│   └── public/               # Static assets
│
├── LLD_DOCUMENT.md           # Detailed Low-Level Design (LLD) document
├── UNIT_TEST_DOCUMENT.md     # Unit testing specification & test matrix
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed on your machine:
- [Bun](https://bun.sh/) (v1.0+)
- [Node.js](https://nodejs.org/) (v18+) & [npm](https://www.npmjs.com/)
- [PostgreSQL](https://www.postgresql.org/) (v14+)
- [Redis](https://redis.io/) (v6+)

---

### 1. Backend Setup

```bash
# Navigate to backend directory
cd chat-backend

# Install dependencies
bun install

# Configure environment variables
# Create or edit .env file:
# PORT=3000
# DATABASE_URL=postgres://user:password@localhost:5432/chat_db
# REDIS_HOST=127.0.0.1
# REDIS_PORT=6379
# JWT_SECRET=your_super_secret_jwt_key

# Push database schema migrations
bun run db:push

# Start the development server
bun run dev
```

The backend server will run on `http://localhost:3000`.

---

### 2. Frontend Setup

```bash
# Navigate to frontend directory
cd chat-frontend

# Install dependencies
npm install

# Start Angular development server
npm start
```

Open your browser and navigate to `http://localhost:4200`.

---

## 🧪 Running Automated Tests

### Backend Tests (Bun Test)
```bash
cd chat-backend
bun test
```

### Frontend Tests (Vitest)
```bash
cd chat-frontend
npm test -- --watch=false
```

---

## 📡 REST API & Socket Events Reference

### REST Endpoints
- `POST /api/v1/auth/register` — Create a new user account
- `POST /api/v1/auth/login` — Login and receive JWT token
- `GET /api/v1/users/me` — Get current user profile
- `GET /api/v1/users` — List registered users with online status
- `GET /api/v1/rooms` — List all community channels
- `POST /api/v1/rooms` — Create a new channel
- `PUT /api/v1/rooms/{roomId}` — Update channel name/description
- `DELETE /api/v1/rooms/{roomId}` — Delete a channel and its message history
- `GET /api/v1/rooms/{roomId}/history` — Retrieve recent message history

### Socket.IO Events
- **Client Emitters**: `join:room`, `leave:room`, `message:send`, `typing:start`, `typing:stop`, `presence:heartbeat`, `room:create`, `room:update`, `room:delete`
- **Client Listeners**: `connected`, `message:received`, `room:history`, `typing:update`, `presence:update`, `presence:response`, `room:created`, `room:updated`, `room:deleted`

---

## 📄 Documentation

- [Low-Level Design (LLD)](LLD_DOCUMENT.md)
- [Unit Testing Specification](UNIT_TEST_DOCUMENT.md)

---

## 📝 License

This project is licensed under the [MIT License](LICENSE).
