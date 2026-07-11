import type { NextApiResponse } from 'next';

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
  INTERNAL_SERVER_ERROR: 500
} as const;

type JsonBody = Record<string, unknown>;

// Success responses
export function ok<T extends JsonBody>(res: NextApiResponse, body: T) {
  return res.status(HTTP_STATUS.OK).json(body);
}

export function created<T extends JsonBody>(res: NextApiResponse, body: T) {
  return res.status(HTTP_STATUS.CREATED).json(body);
}

export function noContent(res: NextApiResponse) {
  return res.status(HTTP_STATUS.NO_CONTENT).end();
}

// Error responses — always the same { error } shape so the client can rely on it
export function badRequest(res: NextApiResponse, error = 'Bad request.') {
  return res.status(HTTP_STATUS.BAD_REQUEST).json({ error });
}

export function unauthorized(res: NextApiResponse, error = 'Unauthorized.') {
  return res.status(HTTP_STATUS.UNAUTHORIZED).json({ error });
}

export function forbidden(res: NextApiResponse, error = 'Forbidden.') {
  return res.status(HTTP_STATUS.FORBIDDEN).json({ error });
}

export function notFound(res: NextApiResponse, error = 'Not found.') {
  return res.status(HTTP_STATUS.NOT_FOUND).json({ error });
}

export function conflict(res: NextApiResponse, error = 'Conflict.') {
  return res.status(HTTP_STATUS.CONFLICT).json({ error });
}

export function serverError(res: NextApiResponse, error = 'Something went wrong.') {
  return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error });
}

// 405 must advertise which methods are allowed via the Allow header (per the HTTP spec).
export function methodNotAllowed(res: NextApiResponse, allowed: string[]) {
  res.setHeader('Allow', allowed);
  return res.status(HTTP_STATUS.METHOD_NOT_ALLOWED).json({ error: 'Method not allowed' });
}
