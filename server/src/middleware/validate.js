import { HttpError } from '../utils/httpError.js';

export function parse(schema, data) {
  const result = schema.safeParse(data ?? {});
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }));
    throw new HttpError(400, details[0]?.message ? `Invalid input: ${details[0].message}` : 'Invalid input', details);
  }
  return result.data;
}

// Validated values land on req.valid.{body,query,params} (Express 5 makes req.query read-only).
export const validate = (schemas) => (req, res, next) => {
  req.valid = req.valid || {};
  for (const [source, schema] of Object.entries(schemas)) {
    req.valid[source] = parse(schema, req[source]);
  }
  next();
};
