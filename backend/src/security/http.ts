import { NextFunction, Request, RequestHandler, Response } from 'express'

export const asyncHandler = (
  handler: (_req: Request, _res: Response, _next: NextFunction) => Promise<void>,
): RequestHandler => {
  return (req, res, next) => {
    void handler(req, res, next).catch(next)
  }
}

export const sendSuccess = (
  res: Response,
  {
    statusCode = 200,
    data,
    message,
    extra,
  }: {
    statusCode?: number
    data?: unknown
    message?: string
    extra?: Record<string, unknown>
  } = {},
): Response => {
  const body: Record<string, unknown> = {
    success: true,
    ...(data !== undefined ? { data } : {}),
    ...(message ? { message } : {}),
    ...(extra ?? {}),
  }

  return res.status(statusCode).json(body)
}
