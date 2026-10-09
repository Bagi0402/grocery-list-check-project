import { util } from '@aws-appsync/utils';

// The current list: everything in the household that hasn't been deleted.
export function request(ctx) {
  return {
    operation: 'Query',
    query: {
      expression: '#h = :h',
      expressionNames: { '#h': 'householdId' },
      expressionValues: util.dynamodb.toMapValues({ ':h': ctx.args.householdId }),
    },
    filter: {
      expression: 'attribute_not_exists(#d)',
      expressionNames: { '#d': 'deletedAt' },
    },
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  return ctx.result.items;
}
