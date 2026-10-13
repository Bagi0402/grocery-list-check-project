// Triggered by the items table's DynamoDB stream.
// Works out what changed, then notifies everyone else in the household.
// The AWS SDK v3 is provided by the Lambda Node.js runtime.
import webpush from 'web-push';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { GetParametersCommand, SSMClient } from '@aws-sdk/client-ssm';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ssm = new SSMClient({});

const {
  MEMBERS_TABLE,
  SUBSCRIPTIONS_TABLE,
  VAPID_PUBLIC_PARAM,
  VAPID_PRIVATE_PARAM,
  VAPID_SUBJECT,
} = process.env;

// Load the VAPID keys once per container and reuse them.
let vapidReady;
function initVapid() {
  if (!vapidReady) {
    vapidReady = (async () => {
      const out = await ssm.send(
        new GetParametersCommand({
          Names: [VAPID_PUBLIC_PARAM, VAPID_PRIVATE_PARAM],
          WithDecryption: true,
        }),
      );
      const values = Object.fromEntries((out.Parameters ?? []).map((p) => [p.Name, p.Value]));
      const publicKey = values[VAPID_PUBLIC_PARAM];
      const privateKey = values[VAPID_PRIVATE_PARAM];
      if (!publicKey || !privateKey) {
        throw new Error('VAPID keys not found in SSM. Run scripts/setup-vapid.sh.');
      }
      webpush.setVapidDetails(VAPID_SUBJECT, publicKey, privateKey);
    })().catch((err) => {
      vapidReady = undefined; // try again on the next invocation
      throw err;
    });
  }
  return vapidReady;
}

// What kind of change was this?
function describe(oldItem, newItem) {
  if (!oldItem) return { kind: 'added' };
  if (newItem.deletedAt && !oldItem.deletedAt) return { kind: 'removed' };
  if (!newItem.deletedAt && oldItem.deletedAt) return { kind: 'readded' };
  if (newItem.checked && !oldItem.checked) return { kind: 'bought' };
  if (!newItem.checked && oldItem.checked) return { kind: 'unticked' };
  if (newItem.assignedTo !== oldItem.assignedTo) return { kind: 'assigned' };
  return { kind: 'updated' };
}

// The same change can read differently for different people.
function textFor(change, recipientId) {
  const forYou = change.assignedTo === recipientId;
  switch (change.kind) {
    case 'added':
      return forYou ? `added ${change.name} for you to buy` : `added ${change.name}`;
    case 'readded':
      return `added ${change.name} back`;
    case 'removed':
      return `removed ${change.name}`;
    case 'bought':
      return `bought ${change.name}`;
    case 'unticked':
      return `unticked ${change.name}`;
    case 'assigned':
      if (forYou) return `asked you to buy ${change.name}`;
      return change.assignedTo ? `assigned ${change.name}` : `unassigned ${change.name}`;
    default:
      return `updated ${change.name}`;
  }
}

async function queryAll(table, keyName, value) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const out = await ddb.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: '#k = :v',
        ExpressionAttributeNames: { '#k': keyName },
        ExpressionAttributeValues: { ':v': value },
        ExclusiveStartKey,
      }),
    );
    items.push(...(out.Items ?? []));
    ExclusiveStartKey = out.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

async function send(subscription, payload) {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      payload,
      { TTL: 3600, urgency: 'normal' },
    );
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) {
      // The device unsubscribed or the app was removed: forget it.
      await ddb.send(
        new DeleteCommand({
          TableName: SUBSCRIPTIONS_TABLE,
          Key: { userId: subscription.userId, endpointHash: subscription.endpointHash },
        }),
      );
      console.log('Removed expired subscription', subscription.endpointHash);
    } else {
      // Don't throw: one failing device shouldn't block everyone else's notifications.
      console.error('Push failed', err.statusCode, err.body ?? err.message);
    }
  }
}

export const handler = async (event) => {
  const changes = [];
  for (const record of event.Records ?? []) {
    if (record.eventName !== 'INSERT' && record.eventName !== 'MODIFY') continue;
    const image = record.dynamodb ?? {};
    if (!image.NewImage) continue;
    const newItem = unmarshall(image.NewImage);
    const oldItem = image.OldImage ? unmarshall(image.OldImage) : null;
    changes.push({
      householdId: newItem.householdId,
      actorId: newItem.updatedBy,
      name: newItem.name,
      assignedTo: newItem.assignedTo ?? null,
      ...describe(oldItem, newItem),
    });
  }
  if (changes.length === 0) return;

  await initVapid();

  // Group by household so each person gets one summary per batch.
  const byHousehold = new Map();
  for (const change of changes) {
    const list = byHousehold.get(change.householdId) ?? [];
    list.push(change);
    byHousehold.set(change.householdId, list);
  }

  let sent = 0;
  for (const [householdId, list] of byHousehold) {
    const members = await queryAll(MEMBERS_TABLE, 'householdId', householdId);
    const names = new Map(members.map((m) => [m.userId, m.displayName]));
    const householdName = members[0]?.householdName ?? 'Your list';

    for (const member of members) {
      // Never notify people about their own changes.
      const relevant = list.filter((c) => c.actorId !== member.userId);
      if (relevant.length === 0) continue;

      const lines = relevant.map((c) => `${names.get(c.actorId) ?? 'Someone'} ${textFor(c, member.userId)}`);
      const body =
        lines.length <= 3
          ? lines.join('\n')
          : `${lines.slice(0, 2).join('\n')}\n…and ${lines.length - 2} more changes`;

      const payload = JSON.stringify({
        title: householdName,
        body,
        tag: `household-${householdId}`, // newer notifications replace older ones
        url: '/',
      });

      const subscriptions = await queryAll(SUBSCRIPTIONS_TABLE, 'userId', member.userId);
      await Promise.all(subscriptions.map((s) => send(s, payload)));
      sent += subscriptions.length;
    }
  }
  console.log(`Processed ${changes.length} change(s), attempted ${sent} notification(s)`);
};
