import { util } from '@aws-appsync/utils';

// Rejects the request unless the signed-in user belongs to the household.
export function request(ctx) {
  const householdId =
    ctx.args.householdId || (ctx.args.input && ctx.args.input.householdId);
  if (!householdId) {
    util.error('householdId is required', 'BadRequest');
  }
  return {
    operation: 'GetItem',
    key: util.dynamodb.toMapValues({ householdId: householdId, userId: ctx.identity.sub }),
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  if (!ctx.result) {
    util.unauthorized();
  }
  return ctx.result;
}
