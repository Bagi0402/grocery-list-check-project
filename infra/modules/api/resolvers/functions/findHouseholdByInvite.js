import { util } from '@aws-appsync/utils';

export function request(ctx) {
  return {
    operation: 'Query',
    index: 'byInviteCode',
    query: {
      expression: '#c = :c',
      expressionNames: { '#c': 'inviteCode' },
      expressionValues: util.dynamodb.toMapValues({ ':c': ctx.args.inviteCode.toUpperCase() }),
    },
    limit: 1,
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  const found = ctx.result.items[0];
  if (!found) {
    util.error('Invite code not found', 'NotFound');
  }
  ctx.stash.household = found;
  return found;
}
