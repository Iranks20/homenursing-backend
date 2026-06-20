import multer from 'multer';

const qualificationUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 10,
  },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/webp',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error('Qualification files must be PDF, Word, JPEG, PNG, or WebP.'));
  },
});

export const uploadQualificationDocuments = qualificationUpload.array('qualificationDocuments', 10);

export default uploadQualificationDocuments;
