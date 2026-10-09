import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const household = {
    id: util.autoId(),
    name: ctx.args.name,
    inviteCode: util.autoId().substring(0, 8).toUpperCase(),
    createdBy: ctx.identity.sub,
    createdAt: util.time.nowISO8601(),
  };
  // putMember (next function) reads this; the pipeline returns it to the caller.
  ctx.stash.household = household;
  ctx.stash.output = household;

  return {
    operation: 'PutItem',
    key: util.dynamodb.toMapValues({ id: household.id }),
    attributeValues: util.dynamodb.toMapValues({
      name: household.name,
      inviteCode: household.inviteCode,
      createdBy: household.createdBy,
      createdAt: household.createdAt,
    }),
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  return ctx.result;
}
