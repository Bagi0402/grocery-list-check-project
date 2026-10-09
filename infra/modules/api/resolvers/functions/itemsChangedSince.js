import { util } from '@aws-appsync/utils';

// Everything changed after `since`, including deletions, for offline catch-up.
export function request(ctx) {
  return {
    operation: 'Query',
    index: 'byUpdatedAt',
    query: {
      expression: '#h = :h AND #u > :since',
      expressionNames: { '#h': 'householdId', '#u': 'updatedAt' },
      expressionValues: util.dynamodb.toMapValues({
        ':h': ctx.args.householdId,
        ':since': ctx.args.since,
      }),
    },
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  return ctx.result.items;
}
