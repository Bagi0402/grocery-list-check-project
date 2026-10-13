import { util } from '@aws-appsync/utils';

// Stores this device's push subscription for the signed-in user.
export function request(ctx) {
  const i = ctx.args.input;
  // The Lambda will send requests to this URL, so only accept HTTPS endpoints.
  if (!i.endpoint.startsWith('https://') || i.endpoint.length > 1000) {
    util.error('Invalid push endpoint', 'BadRequest');
  }
  return {
    operation: 'PutItem',
    key: util.dynamodb.toMapValues({ userId: ctx.identity.sub, endpointHash: i.endpointHash }),
    attributeValues: util.dynamodb.toMapValues({
      endpoint: i.endpoint,
      p256dh: i.p256dh,
      auth: i.auth,
      updatedAt: util.time.nowISO8601(),
    }),
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  return ctx.result;
}
