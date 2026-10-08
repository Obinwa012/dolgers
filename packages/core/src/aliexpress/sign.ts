import { createHmac } from 'node:crypto';

function concat(params: Record<string, string>): string {
  return Object.keys(params)
    .filter((k) => k !== 'sign' && params[k] !== undefined && params[k] !== '')
    .sort()
    .map((k) => `${k}${params[k]}`)
    .join('');
}

/** Business-method signing (the /sync gateway): sorted key+value concat, HMAC-SHA256, upper hex. */
export function signMethod(params: Record<string, string>, appSecret: string): string {
  return createHmac('sha256', appSecret).update(concat(params), 'utf8').digest('hex').toUpperCase();
}

/** System REST signing (token endpoints): API path prefix + sorted key+value concat. */
export function signRest(apiPath: string, params: Record<string, string>, appSecret: string): string {
  return createHmac('sha256', appSecret)
    .update(apiPath + concat(params), 'utf8')
    .digest('hex')
    .toUpperCase();
}
