import type { NextApiResponse } from 'next';
import { strings } from '@/lib/i18n';

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500
} as const;

type JsonBody = Record<string, unknown>;

export function ok<T extends JsonBody>(res: NextApiResponse, body: T) {
  return res.status(HTTP_STATUS.OK).json(body);
}

export function created<T extends JsonBody>(res: NextApiResponse, body: T) {
  return res.status(HTTP_STATUS.CREATED).json(body);
}

export function noContent(res: NextApiResponse) {
  return res.status(HTTP_STATUS.NO_CONTENT).end();
}

function fail(res: NextApiResponse, status: number, error: string, extra?: JsonBody) {
  return res.status(status).json({ error, ...(extra ?? {}) });
}

export function badRequest(res: NextApiResponse, error: string = strings.errors.generic, extra?: JsonBody) {
  return fail(res, HTTP_STATUS.BAD_REQUEST, error, extra);
}

export function unauthorized(res: NextApiResponse, error: string = strings.errors.unauthorized, extra?: JsonBody) {
  return fail(res, HTTP_STATUS.UNAUTHORIZED, error, extra);
}

export function forbidden(res: NextApiResponse, error: string = strings.errors.forbidden, extra?: JsonBody) {
  return fail(res, HTTP_STATUS.FORBIDDEN, error, extra);
}

export function notFound(res: NextApiResponse, error: string = strings.errors.notFound, extra?: JsonBody) {
  return fail(res, HTTP_STATUS.NOT_FOUND, error, extra);
}

export function conflict(res: NextApiResponse, error: string = strings.errors.generic, extra?: JsonBody) {
  return fail(res, HTTP_STATUS.CONFLICT, error, extra);
}

export function payloadTooLarge(res: NextApiResponse, error: string = strings.errors.payloadTooLarge) {
  return fail(res, HTTP_STATUS.PAYLOAD_TOO_LARGE, error);
}

export function tooManyRequests(res: NextApiResponse, error: string = strings.errors.tooManyRequests, extra?: JsonBody) {
  return fail(res, HTTP_STATUS.TOO_MANY_REQUESTS, error, extra);
}

export function serverError(res: NextApiResponse, error: string = strings.errors.generic) {
  return fail(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, error);
}

export function methodNotAllowed(res: NextApiResponse, allowed: string[]) {
  res.setHeader('Allow', allowed);
  return fail(res, HTTP_STATUS.METHOD_NOT_ALLOWED, strings.errors.methodNotAllowed);
}
