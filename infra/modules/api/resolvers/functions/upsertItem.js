import { util } from '@aws-appsync/utils';

// Create or replace an item. Last-write-wins: the write only succeeds if the
// item is new, or the incoming edit is newer than what's stored.
export function request(ctx) {
  const i = ctx.args.input;
  return {
    operation: 'PutItem',
    key: util.dynamodb.toMapValues({ householdId: i.householdId, id: i.id }),
    attributeValues: util.dynamodb.toMapValues({
      name: i.name,
      qty: i.qty,
      category: i.category,
      checked: i.checked,
      assignedTo: i.assignedTo,
      updatedAt: i.updatedAt,
      updatedBy: ctx.identity.sub,
    }),
    condition: {
      expression: 'attribute_not_exists(#id) OR #u < :u',
      expressionNames: { '#id': 'id', '#u': 'updatedAt' },
      expressionValues: util.dynamodb.toMapValues({ ':u': i.updatedAt }),
    },
  };
}

export function response(ctx) {
  if (ctx.error) {
    if (ctx.error.type === 'DynamoDB:ConditionalCheckFailedException') {
      util.error('A newer version of this item already exists', 'Conflict');
    }
    util.error(ctx.error.message, ctx.error.type);
  }
  return ctx.result;
}
