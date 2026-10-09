import { util } from '@aws-appsync/utils';

// Soft delete: mark the item as deleted so the deletion syncs to other devices.
// purgeAt lets DynamoDB's TTL remove it for good after 30 days.
export function request(ctx) {
  const thirtyDays = 30 * 24 * 60 * 60;
  return {
    operation: 'UpdateItem',
    key: util.dynamodb.toMapValues({ householdId: ctx.args.householdId, id: ctx.args.id }),
    update: {
      expression: 'SET #d = :t, #u = :t, #by = :by, #p = :p',
      expressionNames: {
        '#d': 'deletedAt',
        '#u': 'updatedAt',
        '#by': 'updatedBy',
        '#p': 'purgeAt',
      },
      expressionValues: util.dynamodb.toMapValues({
        ':t': ctx.args.updatedAt,
        ':by': ctx.identity.sub,
        ':p': util.time.nowEpochSeconds() + thirtyDays,
      }),
    },
    condition: {
      expression: 'attribute_exists(#cid) AND #cu < :ct',
      expressionNames: { '#cid': 'id', '#cu': 'updatedAt' },
      expressionValues: util.dynamodb.toMapValues({ ':ct': ctx.args.updatedAt }),
    },
  };
}

export function response(ctx) {
  if (ctx.error) {
    if (ctx.error.type === 'DynamoDB:ConditionalCheckFailedException') {
      util.error('Item not found, or it was changed more recently', 'Conflict');
    }
    util.error(ctx.error.message, ctx.error.type);
  }
  return ctx.result;
}
