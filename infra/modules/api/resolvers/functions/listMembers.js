import { util } from '@aws-appsync/utils';

export function request(ctx) {
  return {
    operation: 'Query',
    query: {
      expression: '#h = :h',
      expressionNames: { '#h': 'householdId' },
      expressionValues: util.dynamodb.toMapValues({ ':h': ctx.args.householdId }),
    },
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  return ctx.result.items;
}
