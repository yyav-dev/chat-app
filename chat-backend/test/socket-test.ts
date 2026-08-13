import { io } from "socket.io-client";
import { createServer } from "../src/app";

async function runIntegrationTest() {
  console.log("=== Starting Real-time & Room Integration Test ===");
  const server = await createServer();
  await server.start();
  console.log("✓ Backend server started on port 3000");

  const user1Id = "be8dd248-89af-413b-b868-fec65dba87ee"; // Kokila
  const user2Id = "c093da2e-dc24-4787-8eac-47e67d35575f"; // Obuli

  const roomId = `room_${[user1Id, user2Id].sort().join("_")}`;
  console.log(`✓ Computed deterministic 1-on-1 roomId: ${roomId}`);

  // Connect Socket 1
  const socket1 = io("http://localhost:3000", {
    transports: ["websocket"],
    auth: { userId: user1Id },
  });

  await new Promise<void>((resolve, reject) => {
    socket1.on("connect", () => {
      console.log("✓ Socket 1 connected successfully for User 1 (Kokila)");
      resolve();
    });
    socket1.on("connect_error", reject);
  });

  // Connect Socket 2 and check presence update on Socket 1
  let presenceUpdateReceived = false;
  socket1.on("presence:update", (presence) => {
    console.log("✓ Socket 1 received presence:update:", presence);
    if (presence.userId === user2Id && presence.status === "online") {
      presenceUpdateReceived = true;
    }
  });

  const socket2 = io("http://localhost:3000", {
    transports: ["websocket"],
    auth: { userId: user2Id },
  });

  await new Promise<void>((resolve, reject) => {
    socket2.on("connect", () => {
      console.log("✓ Socket 2 connected successfully for User 2 (Obuli)");
      resolve();
    });
    socket2.on("connect_error", reject);
  });

  // Give presence broadcast time to propagate
  await new Promise((r) => setTimeout(r, 500));

  // Request presence from socket 1
  const presenceResponse = await new Promise<any[]>((resolve) => {
    socket1.emit("presence:request", [user1Id, user2Id]);
    socket1.on("presence:response", (res) => {
      console.log("✓ Socket 1 received presence:response:", res);
      resolve(res);
    });
  });

  const user2Presence = presenceResponse.find((p) => p.id === user2Id);
  if (!user2Presence?.online) {
    throw new Error("User 2 presence should be online!");
  }
  console.log("✓ User 2 presence confirmed online via presence:request");

  // Join room for both sockets
  socket1.emit("join:room", roomId);
  socket2.emit("join:room", roomId);
  console.log(`✓ Both sockets joined room: ${roomId}`);

  await new Promise((r) => setTimeout(r, 300));

  // Test real-time message sending from user 1 to user 2
  const testMessage = "Hello Obuli from Kokila! Real-time message.";
  const messageReceivedPromise = new Promise<any>((resolve) => {
    socket2.on("message:received", (msg) => {
      console.log("✓ Socket 2 received message:received:", msg);
      resolve(msg);
    });
  });

  socket1.emit("message:send", {
    roomId,
    message: testMessage,
    senderId: user1Id,
  });

  const receivedMsg = await messageReceivedPromise;
  if (receivedMsg.message !== testMessage || receivedMsg.roomId !== roomId) {
    throw new Error("Message content or room mismatch!");
  }
  console.log("✓ Real-time message delivered successfully to room!");

  // Test room history retrieval on new join
  const historyPromise = new Promise<any>((resolve) => {
    socket2.on("room:history", (history) => {
      console.log("✓ Socket 2 received room:history:", history);
      resolve(history);
    });
    socket2.emit("join:room", roomId);
  });

  const history = await historyPromise;
  if (!history.messages || history.messages.length === 0) {
    throw new Error("Room history should not be empty!");
  }
  console.log("✓ Room history successfully retrieved from Redis session cache!");

  // Cleanup
  socket1.disconnect();
  socket2.disconnect();
  await server.stop();
  console.log("✓ Server and sockets closed cleanly.");
  console.log("=== ALL INTEGRATION TESTS PASSED ===");
  process.exit(0);
}

runIntegrationTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});