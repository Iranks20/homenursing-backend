import { Request, Response, NextFunction } from 'express';
import { CommunicationService, CreateMessageData } from '../services/communication.service';
import { CustomError } from '../middleware/error.middleware';

const requireParam = (value: string | undefined, name: string): string => {
  if (!value) {
    throw new CustomError(`${name} is required`, 400);
  }
  return value;
};

export class CommunicationController {
  static async getMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const conversationId = req.query.conversationId as string | undefined;
      const userId = req.user?.userId;
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const result = await CommunicationService.getMessages(conversationId, userId, page, limit);
      res.status(200).json({ success: true, data: result.messages, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  static async getMessageById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const messageId = requireParam(req.params.id, 'Message ID');
      const message = await CommunicationService.getMessageById(messageId);
      if (!message) throw new CustomError('Message not found', 404);
      res.status(200).json({ success: true, data: message });
    } catch (error) {
      next(error);
    }
  }

  static async sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const payload = req.body as Partial<CreateMessageData>;

      const senderId = payload.senderId ?? userId;
      if (!senderId) {
        throw new CustomError('Sender ID is required', 400);
      }
      if (!payload.recipientId) {
        throw new CustomError('Recipient ID is required', 400);
      }
      if (!payload.content) {
        throw new CustomError('Message content is required', 400);
      }

      const messagePayload: CreateMessageData = {
        senderId,
        recipientId: payload.recipientId,
        content: payload.content,
      };

      if (payload.subject !== undefined) {
        messagePayload.subject = payload.subject;
      }
      if (payload.conversationId !== undefined) {
        messagePayload.conversationId = payload.conversationId;
      }
      if (payload.attachments !== undefined) {
        messagePayload.attachments = payload.attachments;
      }

      const message = await CommunicationService.createMessage(messagePayload);

      res.status(201).json({ success: true, message: 'Message sent successfully', data: message });
    } catch (error) {
      next(error);
    }
  }

  static async updateMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const messageId = requireParam(req.params.id, 'Message ID');
      const payload = req.body as Partial<CreateMessageData>;
      const message = await CommunicationService.updateMessage(messageId, payload);
      res.status(200).json({ success: true, message: 'Message updated successfully', data: message });
    } catch (error) {
      next(error);
    }
  }

  static async deleteMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const messageId = requireParam(req.params.id, 'Message ID');
      await CommunicationService.deleteMessage(messageId);
      res.status(200).json({ success: true, message: 'Message deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async getConversations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new CustomError('Authentication required', 401);
      }
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const result = await CommunicationService.getConversations(userId, page, limit);
      res.status(200).json({ success: true, data: result.conversations, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  static async getConversationById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new CustomError('Authentication required', 401);
      }
      const conversationId = requireParam(req.params.id, 'Conversation ID');
      const conversation = await CommunicationService.getConversationById(conversationId);
      if (!conversation) throw new CustomError('Conversation not found', 404);
      res.status(200).json({ success: true, data: conversation });
    } catch (error) {
      next(error);
    }
  }
}

