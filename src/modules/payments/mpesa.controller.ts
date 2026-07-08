import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../../types';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import * as mpesaPaymentsService from './mpesa.service';
import { InitiateMpesaInput } from './payments.schema';
import { MpesaCallbackPayload } from '../../integrations/mpesa/mpesa.service';

export const initiateMpesa = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const result = await mpesaPaymentsService.initiateMpesaPayment(
      req.user.userId,
      req.body as InitiateMpesaInput
    );
    return ApiResponse.ok(res, result.message, { checkoutRequestId: result.checkoutRequestId });
  }
);

export const mpesaCallback = asyncHandler(async (req: Request, res: Response) => {
  await mpesaPaymentsService.handleMpesaCallback(req.body as MpesaCallbackPayload);
  res.status(200).json({
    ResultCode: 0,
    ResultDesc: 'Accepted',
  });
});
