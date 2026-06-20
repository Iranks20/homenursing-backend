import { Prisma, SystemConfig } from '@prisma/client';
import prisma from '../config/database';
import { logger } from '../utils/logger';

export interface CreateMessageData {
  senderId: string;
  recipientId: string;
  subject?: string;
  content: string;
  conversationId?: string;
  attachments?: string[];
}

export interface MessageRecord extends CreateMessageData {
  id: string;
  status: 'sent' | 'delivered' | 'read';
  read: boolean;
  createdAt: string;
  updatedAt?: string;
}

const MESSAGE_KEY_PREFIX = 'message_';
const MESSAGE_CATEGORY = 'communication_message';

const toJsonObject = (value: Prisma.JsonValue): Prisma.JsonObject => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Prisma.JsonObject;
  }
  return {};
};

const formatMessage = (record: SystemConfig): MessageRecord | null => {
  if (!record.key.startsWith(MESSAGE_KEY_PREFIX)) {
    return null;
  }

  const value = toJsonObject(record.value);
  const attachments = Array.isArray(value.attachments) ? (value.attachments as string[]) : undefined;
  const message: MessageRecord = {
    id: record.id,
    senderId: String(value.senderId ?? ''),
    recipientId: String(value.recipientId ?? ''),
    content: String(value.content ?? ''),
    status: (value.status as MessageRecord['status']) ?? 'sent',
    read: Boolean(value.read),
    createdAt: String(value.createdAt ?? new Date().toISOString()),
  };

  if (typeof value.subject === 'string') {
    message.subject = value.subject;
  }
  if (typeof value.conversationId === 'string') {
    message.conversationId = value.conversationId;
  }
  if (attachments !== undefined) {
    message.attachments = attachments;
  }
  if (typeof value.updatedAt === 'string') {
    message.updatedAt = value.updatedAt;
  }

  return message;
};

export class CommunicationService {
  static async createMessage(data: CreateMessageData): Promise<MessageRecord> {
    const value: Prisma.JsonObject = {
      senderId: data.senderId,
      recipientId: data.recipientId,
      content: data.content,
      status: 'sent',
      read: false,
      createdAt: new Date().toISOString(),
    };

    if (data.subject !== undefined) {
      value.subject = data.subject;
    }
    if (data.conversationId !== undefined) {
      value.conversationId = data.conversationId;
    }
    if (data.attachments !== undefined) {
      value.attachments = data.attachments;
    }

    const record = await prisma.systemConfig.create({
      data: {
        key: `${MESSAGE_KEY_PREFIX}${Date.now()}`,
        category: MESSAGE_CATEGORY,
        value,
      },
    });

    logger.info('Message created', { messageId: record.id });
    const formatted = formatMessage(record);
    if (!formatted) {
      throw new Error('Failed to create message');
    }
    return formatted;
  }

  static async getMessages(conversationId?: string, userId?: string, page = 1, limit = 20): Promise<{ messages: MessageRecord[]; pagination: { page: number; limit: number; total: number; totalPages: number; } }> {
    const skip = (page - 1) * limit;
    const where: Prisma.SystemConfigWhereInput = {
      key: { startsWith: MESSAGE_KEY_PREFIX },
    };

    if (conversationId) {
      where.value = {
        path: ['conversationId'],
        equals: conversationId,
      } as Prisma.JsonFilter;
    } else if (userId) {
      where.OR = [
        {
          value: {
            path: ['senderId'],
            equals: userId,
          },
        },
        {
          value: {
            path: ['recipientId'],
            equals: userId,
          },
        },
      ];
    }

    const [records, total] = await Promise.all([
      prisma.systemConfig.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.systemConfig.count({ where }),
    ]);

    const messages = records
      .map(formatMessage)
      .filter((message): message is MessageRecord => message !== null);

    return {
      messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getMessageById(id: string): Promise<MessageRecord | null> {
    const record = await prisma.systemConfig.findUnique({ where: { id } });
    if (!record) {
      return null;
    }
    return formatMessage(record);
  }

  static async updateMessage(id: string, data: Partial<CreateMessageData>): Promise<MessageRecord> {
    const existing = await prisma.systemConfig.findUnique({ where: { id } });

    if (!existing) {
      throw new Error('Message not found');
    }

    const currentValue = toJsonObject(existing.value);
    const updatedValue: Prisma.JsonObject = {
      ...currentValue,
      updatedAt: new Date().toISOString(),
    };

    if (data.senderId !== undefined) {
      updatedValue.senderId = data.senderId;
    }
    if (data.recipientId !== undefined) {
      updatedValue.recipientId = data.recipientId;
    }
    if (data.content !== undefined) {
      updatedValue.content = data.content;
    }
    if (data.subject !== undefined) {
      updatedValue.subject = data.subject;
    }
    if (data.conversationId !== undefined) {
      updatedValue.conversationId = data.conversationId;
    }
    if (data.attachments !== undefined) {
      updatedValue.attachments = data.attachments;
    }

    const updated = await prisma.systemConfig.update({
      where: { id },
      data: {
        value: updatedValue,
      },
    });

    logger.info('Message updated', { messageId: id });
    const formatted = formatMessage(updated);
    if (!formatted) {
      throw new Error('Message not found');
    }
    return formatted;
  }

  static async deleteMessage(id: string): Promise<void> {
    const record = await prisma.systemConfig.findUnique({ where: { id } });

    if (!record || !record.key.startsWith(MESSAGE_KEY_PREFIX)) {
      throw new Error('Message not found');
    }

    await prisma.systemConfig.delete({ where: { id } });
    logger.info('Message deleted', { messageId: id });
  }

  static async getConversations(userId: string, page = 1, limit = 20): Promise<{ conversations: Array<{ id: string; participants: [string, string]; lastMessage: MessageRecord; unreadCount: number; createdAt: string; }>; pagination: { page: number; limit: number; total: number; totalPages: number; } }> {
    const messagesResult = await this.getMessages(undefined, userId, 1, 1000);

    const conversationsMap = new Map<string, {
      id: string;
      participants: [string, string];
      lastMessage: MessageRecord;
      unreadCount: number;
      createdAt: string;
    }>();

    messagesResult.messages.forEach((msg) => {
      const convId = msg.conversationId || `${msg.senderId}_${msg.recipientId}`;
      const existing = conversationsMap.get(convId);

      if (!existing) {
        conversationsMap.set(convId, {
          id: convId,
          participants: [msg.senderId, msg.recipientId],
          lastMessage: msg,
          unreadCount: !msg.read && msg.recipientId === userId ? 1 : 0,
          createdAt: msg.createdAt,
        });
        return;
      }

      if (new Date(msg.createdAt).getTime() > new Date(existing.lastMessage.createdAt).getTime()) {
        existing.lastMessage = msg;
      }
      if (!msg.read && msg.recipientId === userId) {
        existing.unreadCount += 1;
      }
    });

    const allConversations = Array.from(conversationsMap.values()).sort(
      (a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime(),
    );

    const paginated = allConversations.slice((page - 1) * limit, page * limit);
    const totalPages = Math.ceil(conversationsMap.size / limit);

    return {
      conversations: paginated,
      pagination: {
        page,
        limit,
        total: conversationsMap.size,
        totalPages,
      },
    };
  }

  static async getConversationById(conversationId: string): Promise<{ id: string; participants: [string, string]; messages: MessageRecord[]; createdAt: string; } | null> {
    const messagesResult = await this.getMessages(conversationId);

    if (messagesResult.messages.length === 0) {
      return null;
    }

    const [firstMessage] = messagesResult.messages;
    if (!firstMessage) {
      return null;
    }

    return {
      id: conversationId,
      participants: [firstMessage.senderId, firstMessage.recipientId],
      messages: messagesResult.messages,
      createdAt: firstMessage.createdAt,
    };
  }
}

