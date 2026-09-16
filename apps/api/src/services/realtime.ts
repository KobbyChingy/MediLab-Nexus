import { EventEmitter } from "node:events";
import { WebSocket } from "ws";

/**
 * Real-time event types broadcasted to connected clients
 */
export type RealtimeEventType =
  | "patient:created"
  | "patient:updated"
  | "patient:deleted"
  | "report:saved"
  | "report:updated"
  | "order:created"
  | "order:updated"
  | "sample:updated"
  | "imaging:updated"
  | "invoice:created"
  | "payment:recorded"
  | "workflow:refresh";

/**
 * Real-time event payload
 */
export interface RealtimeEvent<T = unknown> {
  type: RealtimeEventType;
  timestamp: number;
  actor?: {
    userId: string;
    displayName?: string;
  };
  data: T;
}

/**
 * WebSocket client connection info
 */
interface ClientConnection {
  ws: WebSocket;
  userId?: string;
  displayName?: string;
  role?: string;
  facilityId?: string;
  connectedAt: number;
}

/**
 * Real-time sync manager using WebSocket
 */
class RealtimeSyncManager extends EventEmitter {
  private clients: Map<string, ClientConnection> = new Map();
  private clientIdCounter = 0;

  /**
   * Register a new WebSocket client connection
   */
  addClient(
    ws: WebSocket,
    userId?: string,
    displayName?: string,
    role?: string,
    facilityId?: string,
  ): string {
    const clientId = `client_${++this.clientIdCounter}_${Date.now()}`;
    this.clients.set(clientId, {
      ws,
      userId,
      displayName,
      role,
      facilityId,
      connectedAt: Date.now(),
    });

    // Send welcome message
    this.sendToClient(clientId, {
      type: "connection:established",
      timestamp: Date.now(),
      data: { clientId, connectedClientsCount: this.clients.size },
    } as unknown as RealtimeEvent);

    console.log(
      `[Realtime] Client connected: ${clientId} (user: ${userId}, role: ${role})`,
    );

    return clientId;
  }

  /**
   * Remove a client connection
   */
  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        client.ws.close();
      } catch (e) {
        // Already closed
      }
      this.clients.delete(clientId);
      console.log(`[Realtime] Client disconnected: ${clientId}`);
    }
  }

  /**
   * Send event to a specific client
   */
  sendToClient(clientId: string, event: RealtimeEvent): void {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(event));
      } catch (e) {
        console.error(`[Realtime] Error sending to client ${clientId}:`, e);
        this.removeClient(clientId);
      }
    }
  }

  /**
   * Broadcast event to all connected clients
   */
  broadcastToAll(event: RealtimeEvent): void {
    const payload = JSON.stringify(event);
    let successCount = 0;
    const failedClients: string[] = [];

    for (const [clientId, client] of this.clients.entries()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(payload);
          successCount++;
        } catch (e) {
          console.error(`[Realtime] Error sending to client ${clientId}:`, e);
          failedClients.push(clientId);
        }
      }
    }

    // Clean up failed clients
    failedClients.forEach((clientId) => this.removeClient(clientId));

    if (successCount > 0 || failedClients.length === 0) {
      console.log(
        `[Realtime] Broadcast ${event.type}: ${successCount}/${this.clients.size} clients`,
      );
    }
  }

  /**
   * Broadcast event to specific role(s)
   */
  broadcastToRole(event: RealtimeEvent, ...roles: string[]): void {
    const payload = JSON.stringify(event);
    let successCount = 0;

    for (const [, client] of this.clients.entries()) {
      if (
        client.role &&
        roles.includes(client.role) &&
        client.ws.readyState === WebSocket.OPEN
      ) {
        try {
          client.ws.send(payload);
          successCount++;
        } catch (e) {
          // Error handled in next iteration
        }
      }
    }

    console.log(
      `[Realtime] Broadcast to ${roles.join(",")} for ${event.type}: ${successCount} clients`,
    );
  }

  /**
   * Broadcast event to all except the sender
   */
  broadcastExcept(event: RealtimeEvent, excludeClientId?: string): void {
    const payload = JSON.stringify(event);
    let successCount = 0;

    for (const [clientId, client] of this.clients.entries()) {
      if (
        clientId !== excludeClientId &&
        client.ws.readyState === WebSocket.OPEN
      ) {
        try {
          client.ws.send(payload);
          successCount++;
        } catch (e) {
          // Error handled in next iteration
        }
      }
    }

    console.log(
      `[Realtime] Broadcast (except ${excludeClientId}) ${event.type}: ${successCount} clients`,
    );
  }

  /**
   * Get all connected clients count
   */
  getConnectedCount(): number {
    return this.clients.size;
  }

  /**
   * Get connected clients info
   */
  getConnectedClients(): Array<{
    clientId: string;
    userId?: string;
    displayName?: string;
    role?: string;
    connectedAt: number;
  }> {
    return Array.from(this.clients.entries()).map(([clientId, client]) => ({
      clientId,
      userId: client.userId,
      displayName: client.displayName,
      role: client.role,
      connectedAt: client.connectedAt,
    }));
  }

  /**
   * Get connected users by role
   */
  getConnectedUsersByRole(role: string): string[] {
    const users = new Set<string>();
    for (const client of this.clients.values()) {
      if (client.role === role && client.userId) {
        users.add(client.userId);
      }
    }
    return Array.from(users);
  }
}

// Singleton instance
export const realtimeSyncManager = new RealtimeSyncManager();

/**
 * Emit a real-time event - called from various API endpoints
 */
export function emitRealtimeEvent<T = unknown>(
  type: RealtimeEventType,
  data: T,
  actor?: { userId: string; displayName?: string },
): void {
  const event: RealtimeEvent<T> = {
    type,
    timestamp: Date.now(),
    actor,
    data,
  };

  // Broadcast based on event type
  switch (type) {
    case "patient:created":
    case "patient:updated":
    case "patient:deleted":
    case "report:saved":
    case "report:updated":
    case "workflow:refresh":
      // Send to all connected users
      realtimeSyncManager.broadcastToAll(event);
      break;

    case "invoice:created":
    case "payment:recorded":
      // Send to finance/reception users
      realtimeSyncManager.broadcastToRole(event, "RECEPTION", "MANAGER", "ADMIN");
      break;

    default:
      // Send to all
      realtimeSyncManager.broadcastToAll(event);
  }
}
