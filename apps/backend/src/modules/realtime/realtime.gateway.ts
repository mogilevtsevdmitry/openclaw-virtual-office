import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
  WsResponse,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Inject, LoggerService } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { v4 as uuidv4 } from 'uuid';

interface SubscribePayload {
  tenantId: string;
  floorId?: string;
  sinceEventId?: string;
  token?: string; // JWT, если не передан в handshake
}

interface ClientMeta {
  socket: Socket;
  tenantId?: string;
  floorId?: string;
  userId?: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.WS_CORS_ORIGIN || '*',
    credentials: true,
  },
  namespace: '/realtime',
  transports: ['websocket', 'polling'],
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private connectedClients: Map<string, ClientMeta> = new Map();
  private initialized = false;

  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit(server: Server) {
    this.initialized = true;
    this.logger.log(
      { message: 'WebSocket Gateway initialized', namespace: '/realtime' },
      'RealtimeGateway',
    );
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  handleConnection(client: Socket) {
    const clientId = client.id;

    // Try to authenticate via handshake token
    let userId: string | undefined;
    let tenantId: string | undefined;

    const authToken =
      (client.handshake.auth as any)?.token ||
      (client.handshake.headers as any)?.authorization?.replace('Bearer ', '');

    if (authToken) {
      try {
        const payload = this.jwtService.verify(authToken, {
          secret: this.configService.get<string>('JWT_SECRET') || 'fallback-secret-change-in-prod',
        });
        userId = payload.sub;
        tenantId = payload.tenantId;
      } catch {
        // Token invalid — still allow connection but without auth context
        this.logger.warn(
          { message: 'WS connection with invalid token', clientId },
          'RealtimeGateway',
        );
      }
    }

    this.connectedClients.set(clientId, { socket: client, tenantId, userId });

    // Auto-join tenant room if authenticated
    if (tenantId) {
      client.join(tenantId);
    }

    this.logger.log(
      {
        message: 'Client connected',
        clientId,
        userId,
        tenantId,
        totalConnections: this.connectedClients.size,
        transport: client.conn.transport.name,
      },
      'RealtimeGateway',
    );

    client.emit('connected', {
      clientId,
      timestamp: new Date().toISOString(),
      message: 'Connected to OpenClaw Virtual Office realtime stream',
    });
  }

  handleDisconnect(client: Socket) {
    const clientId = client.id;
    const clientData = this.connectedClients.get(clientId);

    this.logger.log(
      {
        message: 'Client disconnected',
        clientId,
        tenantId: clientData?.tenantId,
        totalConnections: this.connectedClients.size - 1,
      },
      'RealtimeGateway',
    );

    this.connectedClients.delete(clientId);
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @MessageBody() payload: SubscribePayload,
    @ConnectedSocket() client: Socket,
  ): Promise<WsResponse<any>> {
    const { tenantId, floorId, sinceEventId } = payload;
    const traceId = uuidv4();

    // Update client meta
    const existing = this.connectedClients.get(client.id) ?? { socket: client };
    this.connectedClients.set(client.id, { ...existing, tenantId, floorId });

    // Join rooms
    client.join(tenantId);
    if (floorId) {
      client.join(`${tenantId}:${floorId}`);
    }

    this.logger.log(
      { message: 'Client subscribed', clientId: client.id, tenantId, floorId, sinceEventId, traceId },
      'RealtimeGateway',
    );

    return {
      event: 'subscribed',
      data: {
        ok: true,
        room: floorId ? `${tenantId}:${floorId}` : tenantId,
        tenantId,
        floorId,
        sinceEventId,
        traceId,
        timestamp: new Date().toISOString(),
      },
    };
  }

  @SubscribeMessage('ping')
  handlePing(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ): WsResponse<any> {
    return {
      event: 'pong',
      data: { timestamp: new Date().toISOString(), clientId: client.id },
    };
  }

  /**
   * Public method: broadcast WsEvent to tenant/floor room
   */
  broadcastEvent(tenantId: string, floorId: string | null, eventType: string, payload: any) {
    const room = floorId ? `${tenantId}:${floorId}` : tenantId;
    const traceId = uuidv4();

    this.server.to(room).emit('domain_event', {
      eventId: traceId,
      eventType,
      payload,
      tenantId,
      occurredAt: new Date().toISOString(),
    });
  }

  getConnectionStats() {
    return {
      totalConnections: this.connectedClients.size,
      clients: Array.from(this.connectedClients.entries()).map(([id, data]) => ({
        clientId: id,
        tenantId: data.tenantId,
        floorId: data.floorId,
        userId: data.userId,
      })),
    };
  }
}
