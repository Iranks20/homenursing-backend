import fs from 'fs/promises';
import path from 'path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { ENV_CONFIG } from '../config/environment';

export interface CertificatePdfInput {
  candidateName: string;
  certificateNumber: string;
  examTitle: string;
  score: number;
  issuedAt: Date;
}

export class CertificatePdfService {
  private static readonly PAGE_WIDTH = 842;
  private static readonly PAGE_HEIGHT = 595;

  static getStorageDir(): string {
    return path.join(process.cwd(), 'uploads', 'certificates');
  }

  static buildRelativePath(certificateId: string): string {
    return `/uploads/certificates/${certificateId}.pdf`;
  }

  static async generate(input: CertificatePdfInput, certificateId: string): Promise<string> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([this.PAGE_WIDTH, this.PAGE_HEIGHT]);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const navy = rgb(0.12, 0.25, 0.69);
    const gold = rgb(0.79, 0.64, 0.15);
    const gray = rgb(0.35, 0.35, 0.35);

    page.drawRectangle({
      x: 24,
      y: 24,
      width: this.PAGE_WIDTH - 48,
      height: this.PAGE_HEIGHT - 48,
      borderColor: navy,
      borderWidth: 3,
    });
    page.drawRectangle({
      x: 36,
      y: 36,
      width: this.PAGE_WIDTH - 72,
      height: this.PAGE_HEIGHT - 72,
      borderColor: gold,
      borderWidth: 1,
    });

    const centerX = this.PAGE_WIDTH / 2;
    const drawCentered = (text: string, y: number, size: number, font = fontRegular, color = gray) => {
      const width = font.widthOfTextAtSize(text, size);
      page.drawText(text, { x: centerX - width / 2, y, size, font, color });
    };

    drawCentered('TEAMWORK HOMECARE', 500, 22, fontBold, navy);
    drawCentered('Certificate of Qualification', 465, 16, fontBold, navy);
    drawCentered('This certifies that', 410, 12, fontRegular, gray);
    drawCentered(input.candidateName.toUpperCase(), 375, 28, fontBold, navy);
    drawCentered('has successfully completed the required qualification process', 340, 12, fontRegular, gray);
    drawCentered(`including the examination: ${input.examTitle}`, 318, 11, fontRegular, gray);
    drawCentered(`Score: ${input.score.toFixed(1)}%`, 295, 12, fontBold, gray);
    drawCentered(`Certificate No: ${input.certificateNumber}`, 250, 11, fontRegular, gray);
    drawCentered(
      `Issued: ${input.issuedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      228,
      11,
      fontRegular,
      gray
    );
    drawCentered(ENV_CONFIG.CERTIFICATE_SIGNATORY_NAME, 120, 12, fontBold, navy);
    drawCentered(ENV_CONFIG.CERTIFICATE_SIGNATORY_TITLE, 102, 10, fontRegular, gray);

    const bytes = await pdfDoc.save();
    const dir = this.getStorageDir();
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${certificateId}.pdf`);
    await fs.writeFile(filePath, bytes);
    return this.buildRelativePath(certificateId);
  }
}

export default CertificatePdfService;
