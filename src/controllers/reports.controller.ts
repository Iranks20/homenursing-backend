import { Request, Response, NextFunction } from 'express';
import { ReportsService, CustomReportFilters, ScheduleReportData, ReportTemplateData } from '../services/reports.service';
import { CustomError } from '../middleware/error.middleware';

const parseString = (value: unknown, field: string): string => {
  if (value === undefined || value === null || value === '') {
    throw new CustomError(`${field} is required`, 400);
  }
  return String(value);
};

const parseOptionalString = (value: unknown): string | undefined => (value === undefined || value === null || value === '' ? undefined : String(value));

const parseDateParam = (value: unknown, field: string): Date | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new CustomError(`${field} is invalid`, 400);
  }
  return date;
};

const parseFilters = (value: unknown): CustomReportFilters => {
  if (value === undefined || value === null) {
    return {};
  }
  if (typeof value !== 'object') {
    throw new CustomError('filters must be an object', 400);
  }
  return value as CustomReportFilters;
};

const parseScheduleBody = (body: unknown): ScheduleReportData => {
  const data = body as Record<string, unknown>;
  const type = parseString(data.type, 'type');
  const frequency = parseString(data.frequency, 'frequency');
  const recipients = data.recipients;
  if (!Array.isArray(recipients) || recipients.some(r => typeof r !== 'string')) {
    throw new CustomError('recipients must be an array of strings', 400);
  }

  return {
    type,
    frequency,
    recipients,
    filters: parseFilters(data.filters),
  };
};

const parseTemplateBody = (body: unknown): ReportTemplateData => {
  const data = body as Record<string, unknown>;
  const fields = data.fields;
  if (!Array.isArray(fields) || fields.some(f => typeof f !== 'string')) {
    throw new CustomError('fields must be an array of strings', 400);
  }

  return {
    name: parseString(data.name, 'name'),
    description: parseString(data.description, 'description'),
    type: parseString(data.type, 'type'),
    fields,
    query: parseString(data.query, 'query'),
  };
};

const buildReportFilterParams = (query: Request['query']): CustomReportFilters => {
  const filters: CustomReportFilters = {};
  if (query.startDate) filters.startDate = String(query.startDate);
  if (query.endDate) filters.endDate = String(query.endDate);
  if (query.status) filters.status = String(query.status);
  if (query.patientId) filters.patientId = String(query.patientId);
  if (query.serviceId) filters.serviceId = String(query.serviceId);
  return filters;
};

export class ReportsController {
  static async generateCustomReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const source = req.method === 'GET' ? req.query : req.body;
      const type = parseString(source.type, 'type');
      const filters = parseFilters(source.filters);
      const startDate = parseDateParam(source.startDate, 'startDate');
      const endDate = parseDateParam(source.endDate, 'endDate');

      const report = await ReportsService.generateCustomReport(type, filters, startDate, endDate);
      res.status(200).json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }

  static async scheduleReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = parseScheduleBody(req.body);
      const scheduled = await ReportsService.scheduleReport(payload);
      res.status(201).json({ success: true, message: 'Report scheduled successfully', data: scheduled });
    } catch (error) {
      next(error);
    }
  }

  static async getReportTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const templates = await ReportsService.getReportTemplates();
      res.status(200).json({ success: true, data: templates });
    } catch (error) {
      next(error);
    }
  }

  static async createReportTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = parseTemplateBody(req.body);
      const template = await ReportsService.createReportTemplate(payload);
      res.status(201).json({ success: true, message: 'Template created successfully', data: template });
    } catch (error) {
      next(error);
    }
  }

  static async getAppointmentReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const report = await ReportsService.getAppointmentReport(buildReportFilterParams(req.query));
      res.status(200).json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }

  static async getRevenueReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const report = await ReportsService.getRevenueReport(buildReportFilterParams(req.query));
      res.status(200).json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }

  static async getPatientSatisfactionReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const report = await ReportsService.getPatientSatisfactionReport(buildReportFilterParams(req.query));
      res.status(200).json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }

  static async getNurseUtilizationReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const report = await ReportsService.getNurseUtilizationReport(buildReportFilterParams(req.query));
      res.status(200).json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }

  static async exportReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const type = parseString(req.params.type, 'type');
      const format = parseOptionalString(req.query.format) ?? 'json';
      const result = await ReportsService.exportReport(type, format);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

