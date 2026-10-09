import { util } from '@aws-appsync/utils';

export function request(ctx) {
  return {
    operation: 'Query',
    index: 'byUser',
    query: {
      expression: '#u = :u',
      expressionNames: { '#u': 'userId' },
      expressionValues: util.dynamodb.toMapValues({ ':u': ctx.identity.sub }),
    },
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  return ctx.result.items;
}
