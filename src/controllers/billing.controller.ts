import { Request, Response, NextFunction } from 'express';
import { InvoiceStatus, PaymentStatus } from '@prisma/client';
import {
  BillingService,
  CreateInvoiceData,
  CreatePaymentData,
  InvoiceLineInput,
  UpdateInvoiceData,
} from '../services/billing.service';
import { CustomError } from '../middleware/error.middleware';
import { PaymentMethodService } from '../services/paymentMethod.service';

const parseNumber = (value: unknown, fallback: number): number => {
  const parsed = Number.parseInt(value as string, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
};

const requireId = (id: string | undefined, resource = 'resource'): string => {
  if (!id) throw new CustomError(`${resource} ID is required`, 400);
  return id;
};

const parseDate = (value: unknown, field: string): Date => {
  if (!value) throw new CustomError(`${field} is required`, 400);
  const date = new Date(value as string | number);
  if (Number.isNaN(date.getTime())) {
    throw new CustomError(`${field} is invalid`, 400);
  }
  return date;
};

const parseEnum = <T>(enumObj: Record<string, T>, value: unknown, field: string, required = false): T | undefined => {
  if (value === undefined || value === null || value === '') {
    if (required) throw new CustomError(`${field} is required`, 400);
    return undefined;
  }

  const normalized = String(value).toUpperCase();
  if (normalized in enumObj) {
    return enumObj[normalized as keyof typeof enumObj];
  }
  throw new CustomError(`${field} is invalid`, 400);
};

const parseLineInputs = (rawLines: unknown, label: string): InvoiceLineInput[] => {
  if (!Array.isArray(rawLines) || rawLines.length === 0) {
    throw new CustomError(`${label} must be a non-empty array`, 400);
  }
  return rawLines.map((raw, idx) => {
    const line = raw as Record<string, unknown>;
    const serviceId = line.serviceId as string | undefined;
    const consultationProviderId = line.consultationProviderId as string | undefined;
    const consultationSpecialistId = line.consultationSpecialistId as string | undefined;
    const consultationTherapistId = line.consultationTherapistId as string | undefined;
    if (
      !serviceId &&
      !consultationProviderId &&
      !consultationSpecialistId &&
      !consultationTherapistId
    ) {
      throw new CustomError(
        `${label}[${idx}] requires serviceId, consultationProviderId, consultationSpecialistId, or consultationTherapistId`,
        400
      );
    }
    const entry: InvoiceLineInput = {};
    if (serviceId) entry.serviceId = serviceId;
    if (consultationProviderId) entry.consultationProviderId = consultationProviderId;
    if (consultationSpecialistId) entry.consultationSpecialistId = consultationSpecialistId;
    if (consultationTherapistId) entry.consultationTherapistId = consultationTherapistId;
    if (line.quantity !== undefined && line.quantity !== null) {
      entry.quantity = Number(line.quantity);
    }
    if (line.unitPrice !== undefined && line.unitPrice !== null) {
      entry.unitPrice = Number(line.unitPrice);
    }
    if (line.description !== undefined && line.description !== null) {
      entry.description = String(line.description);
    }
    if (line.procedureCode !== undefined) {
      entry.procedureCode = line.procedureCode === null ? null : String(line.procedureCode);
    }
    return entry;
  });
};

const parseInvoicePayload = (body: unknown): CreateInvoiceData => {
  const data = body as Record<string, unknown>;
  const patientId = data.patientId as string | undefined;
  const description = data.description as string | undefined;

  if (!patientId) throw new CustomError('patientId is required', 400);
  if (!description) throw new CustomError('description is required', 400);

  const payload: CreateInvoiceData = {
    patientId,
    date: parseDate(data.date, 'date'),
    dueDate: parseDate(data.dueDate, 'dueDate'),
    description,
  };

  const status = parseEnum(InvoiceStatus, data.status, 'status', false);
  if (status !== undefined) payload.status = status;

  if (Array.isArray(data.lines) && data.lines.length > 0) {
    payload.lines = parseLineInputs(data.lines, 'lines');
    return payload;
  }

  const serviceId = data.serviceId as string | undefined;
  if (!serviceId) {
    throw new CustomError('lines or serviceId is required', 400);
  }
  const amount = data.amount as number | string | undefined;
  if (amount === undefined || amount === null || Number.isNaN(Number(amount))) {
    throw new CustomError('amount is required when lines are omitted', 400);
  }
  payload.serviceId = serviceId;
  payload.amount = Number(amount);
  return payload;
};

const parseInvoiceUpdatePayload = (body: unknown): UpdateInvoiceData => {
  const data = body as Record<string, unknown>;
  const payload: UpdateInvoiceData = {};

  if (data.patientId !== undefined) payload.patientId = data.patientId as string;
  if (data.date !== undefined) payload.date = parseDate(data.date, 'date');
  if (data.dueDate !== undefined) payload.dueDate = parseDate(data.dueDate, 'dueDate');
  if (data.description !== undefined) payload.description = data.description as string;

  const status = parseEnum(InvoiceStatus, data.status, 'status', false);
  if (status !== undefined) payload.status = status;

  if (data.lines !== undefined) {
    if (!Array.isArray(data.lines)) {
      throw new CustomError('lines must be an array', 400);
    }
    if (data.lines.length === 0) {
      throw new CustomError('lines must not be empty when provided', 400);
    }
    payload.lines = parseLineInputs(data.lines, 'lines');
  }

  return payload;
};

const parsePaymentPayload = (body: unknown): CreatePaymentData => {
  const data = body as Record<string, unknown>;
  const patientId = data.patientId as string | undefined;
  const invoiceId = data.invoiceId as string | undefined;
  const amount = data.amount as number | string | undefined;
  const method = data.method as string | undefined;
  const description = data.description as string | undefined;

  if (!patientId) throw new CustomError('patientId is required', 400);
  if (!invoiceId) throw new CustomError('invoiceId is required', 400);
  if (amount === undefined || amount === null || Number.isNaN(Number(amount))) {
    throw new CustomError('amount is required', 400);
  }
  if (!method || method.trim() === '') {
    throw new CustomError('method is required', 400);
  }
  if (!description) throw new CustomError('description is required', 400);

  const payload: CreatePaymentData = {
    patientId,
    invoiceId,
    amount: Number(amount),
    method: method.trim(),
    description,
  };

  if (data.transactionId !== undefined) payload.transactionId = data.transactionId as string;
  const status = parseEnum(PaymentStatus, data.status, 'status', false);
  if (status !== undefined) payload.status = status;

  return payload;
};

const parseReportFilters = (query: Request['query']): { startDate?: string; endDate?: string; patientId?: string } => {
  const filters: { startDate?: string; endDate?: string; patientId?: string } = {};
  if (query.startDate) filters.startDate = String(query.startDate);
  if (query.endDate) filters.endDate = String(query.endDate);
  if (query.patientId) filters.patientId = String(query.patientId);
  return filters;
};

export class BillingController {
  private static async validatePaymentMethod(method: string): Promise<void> {
    const methods = await PaymentMethodService.getPaymentMethods(true);
    const valid = methods.some((m) => m.name.trim().toLowerCase() === method.trim().toLowerCase());
    if (!valid) {
      throw new CustomError('Selected payment method is invalid', 400);
    }
  }
  static async getInvoices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseNumber(req.query.page, 1);
      const limit = parseNumber(req.query.limit, 10);
      const statusFilter = req.query.status ? String(req.query.status) : 'unpaid';
      const includeArchived = req.query.includeArchived === 'true';
      const filters: Parameters<typeof BillingService.getInvoices>[0] = {
        page,
        limit,
        statusFilter,
        includeArchived,
      };
      if (req.query.patientId) filters.patientId = String(req.query.patientId);
      if (req.query.dateFrom) filters.dateFrom = String(req.query.dateFrom);
      if (req.query.dateTo) filters.dateTo = String(req.query.dateTo);
      if (req.query.period) filters.period = String(req.query.period);
      const result = await BillingService.getInvoices(filters);
      res.status(200).json({ success: true, data: result.invoices, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  static async getInvoiceById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoiceId = requireId(req.params.id, 'Invoice');
      const invoice = await BillingService.getInvoiceById(invoiceId);
      if (!invoice) throw new CustomError('Invoice not found', 404);
      res.status(200).json({ success: true, data: invoice });
    } catch (error) {
      next(error);
    }
  }

  static async createInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = parseInvoicePayload(req.body);
      const invoice = await BillingService.createInvoice(payload);
      res.status(201).json({ success: true, message: 'Invoice created successfully', data: invoice });
    } catch (error) {
      next(error);
    }
  }

  static async updateInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoiceId = requireId(req.params.id, 'Invoice');
      const payload = parseInvoiceUpdatePayload(req.body);
      const invoice = await BillingService.updateInvoice(invoiceId, payload);
      res.status(200).json({ success: true, message: 'Invoice updated successfully', data: invoice });
    } catch (error) {
      next(error);
    }
  }

  static async archiveInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoiceId = requireId(req.params.id, 'Invoice');
      const invoice = await BillingService.archiveInvoice(invoiceId);
      res.status(200).json({ success: true, message: 'Invoice archived successfully', data: invoice });
    } catch (error) {
      next(error);
    }
  }

  static async deleteInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoiceId = requireId(req.params.id, 'Invoice');
      await BillingService.deleteInvoice(invoiceId);
      res.status(200).json({ success: true, message: 'Invoice deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async getPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patientId = req.query.patientId ? String(req.query.patientId) : undefined;
      const page = parseNumber(req.query.page, 1);
      const limit = parseNumber(req.query.limit, 10);
      const result = await BillingService.getPayments(patientId, page, limit);
      res.status(200).json({ success: true, data: result.payments, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  static async getPaymentById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paymentId = requireId(req.params.id, 'Payment');
      const payment = await BillingService.getPaymentById(paymentId);
      if (!payment) throw new CustomError('Payment not found', 404);
      res.status(200).json({ success: true, data: payment });
    } catch (error) {
      next(error);
    }
  }

  static async createPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = parsePaymentPayload(req.body);
      await BillingController.validatePaymentMethod(payload.method);
      const payment = await BillingService.createPayment(payload);
      res.status(201).json({ success: true, message: 'Payment processed successfully', data: payment });
    } catch (error) {
      next(error);
    }
  }

  static async generateInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = req.body as { patientId?: string; serviceId?: string; appointmentId?: string };
      if (!payload.patientId) throw new CustomError('patientId is required', 400);
      if (!payload.serviceId) throw new CustomError('serviceId is required', 400);
      const generatePayload: { patientId: string; serviceId: string; appointmentId?: string } = {
        patientId: payload.patientId,
        serviceId: payload.serviceId,
      };
      if (payload.appointmentId) {
        generatePayload.appointmentId = payload.appointmentId;
      }
      const invoice = await BillingService.generateInvoice(generatePayload);
      res.status(201).json({ success: true, message: 'Invoice generated successfully', data: invoice });
    } catch (error) {
      next(error);
    }
  }

  static async processPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = parsePaymentPayload(req.body);
      await BillingController.validatePaymentMethod(payload.method);
      const payment = await BillingService.processPayment(payload);
      res.status(201).json({ success: true, message: 'Payment processed successfully', data: payment });
    } catch (error) {
      next(error);
    }
  }

  static async getRevenueReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const report = await BillingService.getRevenueReport(parseReportFilters(req.query));
      res.status(200).json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }

  static async getOutstandingPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const report = await BillingService.getOutstandingPayments(parseReportFilters(req.query));
      res.status(200).json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }

  static async getBillingSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters: Parameters<typeof BillingService.getBillingSummary>[0] = {};
      if (req.query.period) filters.period = String(req.query.period);
      if (req.query.dateFrom) filters.dateFrom = String(req.query.dateFrom);
      if (req.query.dateTo) filters.dateTo = String(req.query.dateTo);
      const summary = await BillingService.getBillingSummary(filters);
      res.status(200).json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  }

  static async getConsultationProviders(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const providers = await BillingService.getConsultationProviders();
      res.status(200).json({ success: true, data: providers });
    } catch (error) {
      next(error);
    }
  }
}

