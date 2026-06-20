import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { FileUploadService } from '../services/fileUpload.service';
import { CustomError } from '../middleware/error.middleware';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const ensureFile = (file: Express.Multer.File | undefined): Express.Multer.File => {
  if (!file) {
    throw new CustomError('No file uploaded', 400);
  }
  return file;
};

const requireFileId = (fileId: string | undefined): string => {
  if (!fileId) {
    throw new CustomError('File ID is required', 400);
  }
  return fileId;
};

export class FileUploadController {
  static uploadAvatar = upload.single('file');
  
  static async handleAvatarUpload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const file = ensureFile(req.file);
      const result = await FileUploadService.uploadFile(file, 'avatar');
      res.status(200).json({
        success: true,
        message: 'Avatar uploaded successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static uploadDocument = upload.single('file');
  
  static async handleDocumentUpload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const file = ensureFile(req.file);
      const result = await FileUploadService.uploadFile(file, 'document');
      res.status(200).json({
        success: true,
        message: 'Document uploaded successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static uploadImage = upload.single('file');
  
  static async handleImageUpload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const file = ensureFile(req.file);
      const result = await FileUploadService.uploadFile(file, 'image');
      res.status(200).json({
        success: true,
        message: 'Image uploaded successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const fileId = requireFileId(req.params.fileId);
      await FileUploadService.deleteFile(fileId);
      res.status(200).json({
        success: true,
        message: 'File deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

