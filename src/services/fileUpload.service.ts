import { logger } from '../utils/logger';
import { CustomError } from '../middleware/error.middleware';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';

export interface FileUploadResult {
  fileId: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  url: string;
}

export class FileUploadService {
  private static readonly UPLOAD_DIR = path.join(process.cwd(), 'uploads');
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly ALLOWED_TYPES = {
    avatar: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    qualification: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/webp',
    ],
  };

  static async ensureUploadDir(): Promise<void> {
    try {
      await fs.mkdir(this.UPLOAD_DIR, { recursive: true });
    } catch (error) {
      logger.error('Failed to create upload directory', error);
    }
  }

  static async uploadFile(file: Express.Multer.File, type: 'avatar' | 'document' | 'image'): Promise<FileUploadResult> {
    if (file.size > this.MAX_FILE_SIZE) {
      throw new CustomError('File size exceeds maximum allowed size (10MB)', 400);
    }

    const allowedTypes = this.ALLOWED_TYPES[type];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new CustomError(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`, 400);
    }

    await this.ensureUploadDir();

    const fileId = randomUUID();
    const ext = path.extname(file.originalname);
    const filename = `${fileId}${ext}`;
    const filePath = path.join(this.UPLOAD_DIR, filename);

    await fs.writeFile(filePath, file.buffer);

    const result: FileUploadResult = {
      fileId,
      filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: `/uploads/${filename}`,
    };

    logger.info('File uploaded', { fileId, type, filename });
    return result;
  }

  static async uploadQualificationDocument(
    file: Express.Multer.File,
    applicationId: string
  ): Promise<FileUploadResult> {
    if (file.size > this.MAX_FILE_SIZE) {
      throw new CustomError('File size exceeds maximum allowed size (10MB)', 400);
    }

    const allowedTypes = this.ALLOWED_TYPES.qualification;
    if (!allowedTypes.includes(file.mimetype)) {
      throw new CustomError(
        `Qualification file type not allowed. Allowed: PDF, Word, JPEG, PNG, WebP`,
        400
      );
    }

    const qualificationDir = path.join(this.UPLOAD_DIR, 'qualifications', applicationId);
    await fs.mkdir(qualificationDir, { recursive: true });

    const fileId = randomUUID();
    const ext = path.extname(file.originalname) || '';
    const filename = `${fileId}${ext}`;
    const filePath = path.join(qualificationDir, filename);

    await fs.writeFile(filePath, file.buffer);

    const result: FileUploadResult = {
      fileId,
      filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: `/uploads/qualifications/${applicationId}/${filename}`,
    };

    logger.info('Qualification document uploaded', { fileId, applicationId, filename });
    return result;
  }

  static async deleteFile(fileId: string): Promise<void> {
    if (!fileId) {
      throw new CustomError('File ID is required', 400);
    }

    try {
      const files = await fs.readdir(this.UPLOAD_DIR);
      const file = files.find(f => f.startsWith(fileId));
      
      if (file) {
        await fs.unlink(path.join(this.UPLOAD_DIR, file));
        logger.info('File deleted', { fileId, filename: file });
      } else {
        throw new CustomError('File not found', 404);
      }
    } catch (error) {
      if (error instanceof CustomError) throw error;
      throw new CustomError('Failed to delete file', 500);
    }
  }
}

