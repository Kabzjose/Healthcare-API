import { Response } from 'express';
import * as paymentsService from './payments.service';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { AuthenticatedRequest } from '../../types';
import { ListPaymentsQuery } from './payments.schema';

// ── GET /payments/my ──────────────────────────────────────────────────────────
// Patient views their payment history
export const getMyPayments = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const result = await paymentsService.getPatientPayments(
      req.user.userId,
      req.query as unknown as ListPaymentsQuery
    );
    return ApiResponse.ok(res, 'Payments fetched', result.data, result.meta as Record<string, unknown>);
  }
);
