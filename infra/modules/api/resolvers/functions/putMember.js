import { util } from '@aws-appsync/utils';

// Adds the signed-in user to ctx.stash.household (set by the previous function).
export function request(ctx) {
  const h = ctx.stash.household;
  return {
    operation: 'PutItem',
    key: util.dynamodb.toMapValues({ householdId: h.id, userId: ctx.identity.sub }),
    attributeValues: util.dynamodb.toMapValues({
      householdName: h.name,
      displayName: ctx.args.displayName,
      role: h.createdBy === ctx.identity.sub ? 'owner' : 'member',
      joinedAt: util.time.nowISO8601(),
    }),
    condition: {
      expression: 'attribute_not_exists(#u)',
      expressionNames: { '#u': 'userId' },
    },
  };
}

export function response(ctx) {
  if (ctx.error) {
    if (ctx.error.type === 'DynamoDB:ConditionalCheckFailedException') {
      util.error('You are already a member of this household', 'AlreadyMember');
    }
    util.error(ctx.error.message, ctx.error.type);
  }
  return ctx.result;
}
