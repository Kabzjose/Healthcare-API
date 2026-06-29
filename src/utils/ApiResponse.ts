import { Response } from 'express';

interface ApiResponseBody<T> {
  success: boolean;
  message: string;
  data?: T;
  meta?: Record<string, unknown>; // for pagination info, counts, etc.
}

export class ApiResponse {
  // ── 200 OK ────────────────────────────────────────────────────────────────
  static ok<T>(res: Response, message: string, data?: T, meta?: Record<string, unknown>) {
    return res.status(200).json(this.build(true, message, data, meta));
  }

  // ── 201 Created ───────────────────────────────────────────────────────────
  static created<T>(res: Response, message: string, data?: T) {
    return res.status(201).json(this.build(true, message, data));
  }

  // ── 204 No Content (delete operations) ────────────────────────────────────
  static noContent(res: Response) {
    return res.status(204).send();
  }

  // ── Builder ───────────────────────────────────────────────────────────────
  private static build<T>(
    success: boolean,
    message: string,
    data?: T,
    meta?: Record<string, unknown>
  ): ApiResponseBody<T> {
    const body: ApiResponseBody<T> = { success, message };
    if (data !== undefined) body.data = data;
    if (meta !== undefined) body.meta = meta;
    return body;
  }
}