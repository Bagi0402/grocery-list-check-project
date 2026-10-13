import { util } from '@aws-appsync/utils';

// Removes one of the signed-in user's devices from notifications.
export function request(ctx) {
  return {
    operation: 'DeleteItem',
    key: util.dynamodb.toMapValues({
      userId: ctx.identity.sub,
      endpointHash: ctx.args.endpointHash,
    }),
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  return ctx.result;
}
