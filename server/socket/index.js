const { supabase } = require("../services/supabase");
const ot = require("ot-text").type;

/**
 * CodeSync Socket Controller
 * Uses industry-standard OT (ot-text) for robust collaboration.
 */

// In-memory state per session
const sessionState = new Map();
// { [sessionId]: { content, version, pendingOps: [], lastSavedVersion: 0, eventBuffer: [] } }

function getState(sessionId, initialContent = "") {
  if (!sessionState.has(sessionId)) {
    sessionState.set(sessionId, {
      content: initialContent,
      version: 0,
      pendingOps: [], // Stores { op, version, userId }
      lastSavedVersion: 0,
      eventBuffer: [],
      startVersion: 0, // The version at index 0 of pendingOps
    });
  }
  return sessionState.get(sessionId);
}

// Batch save events to Supabase
async function flushEvents(sessionId) {
  const state = sessionState.get(sessionId);
  if (!state || state.eventBuffer.length === 0) return;

  const events = [...state.eventBuffer];
  state.eventBuffer = [];

  try {
    const { error } = await supabase.from("session_events").insert(events);
    if (error) throw error;
  } catch (err) {
    console.error("Failed to flush events:", err);
    // Put back in buffer? No, for now just log. 
    // In production, we'd want a retry mechanism.
  }
}

const setupSocket = (io) => {
  io.on("connection", (socket) => {
    const user = socket.user;
    console.log(`🔌 Connected: ${user.username} (${socket.id})`);

    // Heartbeat to detect dead connections
    socket.on("ping", () => socket.emit("pong"));

    // ── Join session room ──────────────────────────────────────────────────
    socket.on("join_session", async ({ sessionId, role }) => {
      socket.join(sessionId);
      socket.sessionId = sessionId;
      socket.role = role || "candidate";

      // Broadcast to others in room
      socket.to(sessionId).emit("user_joined", {
        userId: user.id,
        username: user.username,
        role: socket.role,
      });

      // Send current doc state to the joining user
      const state = getState(sessionId);
      socket.emit("doc_state", {
        content: state.content,
        version: state.version,
      });

      console.log(`${user.username} joined session ${sessionId} as ${socket.role}`);
    });

    // ── OT: receive operation from client ──────────────────────────────────
    socket.on("op", ({ sessionId, op, clientVersion }) => {
      // C-4: Validate the sender is in the session they claim to be editing
      if (sessionId !== socket.sessionId) {
        return socket.emit("error", { message: "Not a member of this session" });
      }

      const state = getState(sessionId);

      // 1. Transform incoming op against concurrent historic ops
      // clientVersion is what the client thought the version was
      let transformedOp = op;
      
      // Calculate start index in pendingOps
      const startIndex = clientVersion - state.startVersion;
      
      if (startIndex < 0) {
        // Client is too far behind, we already pruned these ops
        return socket.emit("sync_required", { reason: "History pruned" });
      }

      const concurrentOps = state.pendingOps.slice(startIndex);
      for (const historic of concurrentOps) {
        // ot-text transform(op, other, side)
        // 'left' side wins on ties
        transformedOp = ot.transform(transformedOp, historic.op, "left");
      }

      // 2. Apply to server content
      try {
        state.content = ot.apply(state.content, transformedOp);
        state.version++;
        
        const opEntry = { op: transformedOp, version: state.version, userId: user.id };
        state.pendingOps.push(opEntry);

        // 3. P-1: Keep history manageable using slice (avoids O(n) shift on every prune)
        // Trim in batches of 100 when we exceed 1100, keeping the last 1000
        if (state.pendingOps.length > 1100) {
          const trimCount = state.pendingOps.length - 1000;
          state.pendingOps = state.pendingOps.slice(trimCount);
          state.startVersion += trimCount;
        }

        // 4. Acknowledge to sender
        socket.emit("op_ack", { version: state.version });

        // 5. Broadcast transformed op to all others in room
        socket.to(sessionId).emit("op", {
          op: transformedOp,
          version: state.version,
          userId: user.id,
          username: user.username,
        });

        // 6. Persistence (Batched)
        state.eventBuffer.push({
          session_id: sessionId,
          user_id: user.id,
          username: user.username,
          type: "op",
          data: transformedOp,
          timestamp: new Date().toISOString(),
        });

        if (state.eventBuffer.length >= 10) {
          flushEvents(sessionId);
        }

        // Periodically save full snapshot
        if (state.version % 50 === 0) {
          supabase
            .from("sessions")
            .update({ code_content: state.content, updated_at: new Date().toISOString() })
            .eq("id", sessionId)
            .then(() => {})
            .catch(console.error);
        }
      } catch (err) {
        console.error("OT Apply Error:", err);
        socket.emit("error", { message: "Failed to apply operation" });
      }
    });

    // ── Full code sync ─────────────────────────────────────────────────────
    socket.on("sync_code", async ({ sessionId }) => {
      try {
        const { data } = await supabase
          .from("sessions")
          .select("code_content, language")
          .eq("id", sessionId)
          .single();

        if (data) {
          const state = getState(sessionId, data.code_content);
          // Only update if we don't have active memory state or if specifically requested
          socket.emit("doc_state", {
            content: state.content,
            version: state.version,
            language: data.language
          });
        }
      } catch (err) {
        console.error("sync_code error:", err);
      }
    });

    // ── Language change ────────────────────────────────────────────────────
    socket.on("language_change", ({ sessionId, language }) => {
      const state = getState(sessionId);
      supabase
        .from("sessions")
        .update({ language })
        .eq("id", sessionId)
        .then(() => {})
        .catch(console.error);

      socket.to(sessionId).emit("language_change", { language, username: user.username });
      
      // Log event and flush immediately (low-frequency, high-importance event — C-7b)
      state.eventBuffer.push({
        session_id: sessionId,
        user_id: user.id,
        username: user.username,
        type: "language_change",
        data: { language },
        timestamp: new Date().toISOString(),
      });
      flushEvents(sessionId);
    });

    // ── Cursor position ────────────────────────────────────────────────────
    socket.on("cursor", ({ sessionId, position, selection }) => {
      const state = getState(sessionId);
      socket.to(sessionId).emit("cursor", {
        userId: user.id,
        username: user.username,
        position,
        selection,
        version: state.version, // Include version for better client-side adjustment
      });
    });

    // ── Code execution result ──────────────────────────────────────────────
    // C-5: The REST /execute/run route already broadcasts execution_result to
    // the session room. This socket handler is kept ONLY as a fallback path
    // for clients that need to manually relay a result (e.g. offline retry).
    // It does NOT re-broadcast to the room to prevent double-delivery.
    socket.on("execution_result", ({ sessionId, result }) => {
      const state = getState(sessionId);
      // Only persist to event buffer — do NOT emit to room (REST already did it)
      state.eventBuffer.push({
        session_id: sessionId,
        user_id: user.id,
        username: user.username,
        type: "execution",
        data: result,
        timestamp: new Date().toISOString(),
      });
    });

    // ── Chat message ───────────────────────────────────────────────────────
    socket.on("chat_message", ({ sessionId, message }) => {
      const timestamp = new Date().toISOString();
      io.to(sessionId).emit("chat_message", {
        userId: user.id,
        username: user.username,
        message,
        timestamp,
      });

      // P-5: Persist chat to event buffer so it appears in session replay
      const state = getState(sessionId);
      state.eventBuffer.push({
        session_id: sessionId,
        user_id: user.id,
        username: user.username,
        type: "chat",
        data: { message },
        timestamp,
      });
    });

    // ── WebRTC signaling ───────────────────────────────────────────────────
    socket.on("webrtc_offer", ({ sessionId, offer, targetId }) => {
      socket.to(targetId || sessionId).emit("webrtc_offer", {
        offer,
        fromId: socket.id,
        fromUsername: user.username,
      });
    });

    socket.on("webrtc_answer", ({ sessionId, answer, targetId }) => {
      socket.to(targetId).emit("webrtc_answer", {
        answer,
        fromId: socket.id,
      });
    });

    socket.on("webrtc_ice", ({ sessionId, candidate, targetId }) => {
      socket.to(targetId || sessionId).emit("webrtc_ice", {
        candidate,
        fromId: socket.id,
      });
    });

    // ── Session end broadcast ──────────────────────────────────────────────
    socket.on("end_session", ({ sessionId }) => {
      io.to(sessionId).emit("session_ended", { endedBy: user.username });
      flushEvents(sessionId);
    });

    // ── Disconnect ─────────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      if (socket.sessionId) {
        socket.to(socket.sessionId).emit("user_left", {
          userId: user.id,
          username: user.username,
        });
        
        const state = sessionState.get(socket.sessionId);
        if (state) {
          flushEvents(socket.sessionId);
          // Final save if it's the last user
          const room = io.sockets.adapter.rooms.get(socket.sessionId);
          if (!room || room.size === 0) {
            supabase
              .from("sessions")
              .update({ code_content: state.content, updated_at: new Date().toISOString() })
              .eq("id", socket.sessionId)
              .then(() => {
                // P-1: Schedule stale session cleanup after 5 minutes of inactivity
                // Allows any rapid reconnects to still find the state, then frees memory
                setTimeout(() => {
                  const currentRoom = io.sockets.adapter.rooms.get(socket.sessionId);
                  if (!currentRoom || currentRoom.size === 0) {
                    sessionState.delete(socket.sessionId);
                    console.log(`🧹 Cleaned up in-memory state for session ${socket.sessionId}`);
                  }
                }, 5 * 60 * 1000);
              })
              .catch(console.error);
          }
        }
      }
      console.log(`❌ Disconnected: ${user.username}`);
    });
  });

  // Global cleanup interval (every 1 minute)
  setInterval(() => {
    for (const [sessionId, state] of sessionState.entries()) {
      if (state.eventBuffer.length > 0) {
        flushEvents(sessionId);
      }
    }
  }, 60000);
};

module.exports = { setupSocket };
