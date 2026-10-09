import { generateClient } from 'aws-amplify/api';
import type { GraphQLResult } from 'aws-amplify/api';

// All calls go to AppSync, signed with the user's Cognito token.
const client = generateClient();

// ---------- Types (match schema.graphql) ----------
export type Item = {
  householdId: string;
  id: string;
  name: string;
  qty: string | null;
  category: string | null;
  checked: boolean;
  assignedTo: string | null;
  updatedAt: string;
  updatedBy: string;
  deletedAt: string | null;
};

export type Membership = {
  householdId: string;
  householdName: string;
  displayName: string;
  role: string;
  inviteCode: string | null;
};

export type Member = {
  userId: string;
  displayName: string;
  role: string;
};

// ---------- GraphQL documents ----------
// Mutations and the subscription request the same fields: subscribers only
// receive fields that the mutation asked for.
const ITEM_FIELDS = `
  householdId id name qty category checked assignedTo updatedAt updatedBy deletedAt
`;

const MY_HOUSEHOLDS = /* GraphQL */ `
  query MyHouseholds {
    myHouseholds { householdId householdName displayName role inviteCode }
  }
`;

const CREATE_HOUSEHOLD = /* GraphQL */ `
  mutation CreateHousehold($name: String!, $displayName: String!) {
    createHousehold(name: $name, displayName: $displayName) { id name inviteCode }
  }
`;

const JOIN_HOUSEHOLD = /* GraphQL */ `
  mutation JoinHousehold($inviteCode: String!, $displayName: String!) {
    joinHousehold(inviteCode: $inviteCode, displayName: $displayName) {
      householdId householdName role
    }
  }
`;

const HOUSEHOLD_MEMBERS = /* GraphQL */ `
  query HouseholdMembers($householdId: ID!) {
    householdMembers(householdId: $householdId) { userId displayName role }
  }
`;

const LIST_ITEMS = /* GraphQL */ `
  query ListItems($householdId: ID!) {
    listItems(householdId: $householdId) { ${ITEM_FIELDS} }
  }
`;

const UPSERT_ITEM = /* GraphQL */ `
  mutation UpsertItem($input: UpsertItemInput!) {
    upsertItem(input: $input) { ${ITEM_FIELDS} }
  }
`;

const DELETE_ITEM = /* GraphQL */ `
  mutation DeleteItem($householdId: ID!, $id: ID!, $updatedAt: AWSDateTime!) {
    deleteItem(householdId: $householdId, id: $id, updatedAt: $updatedAt) { ${ITEM_FIELDS} }
  }
`;

const ON_ITEM_CHANGED = /* GraphQL */ `
  subscription OnItemChanged($householdId: ID!) {
    onItemChanged(householdId: $householdId) { ${ITEM_FIELDS} }
  }
`;

// ---------- Helpers ----------
async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  // Amplify's types expect generated GraphQL types; our helper uses plain
  // strings, so we tell TypeScript to accept our variables object as-is.
  const result = (await client.graphql({
    query,
    variables: variables as never,
  })) as GraphQLResult<T>;
  return result.data as T;
}

type GraphQLErrorLike = { message?: string; errorType?: string };

function errorsOf(e: unknown): GraphQLErrorLike[] {
  if (e && typeof e === 'object' && 'errors' in e) {
    const errors = (e as { errors?: GraphQLErrorLike[] }).errors;
    if (Array.isArray(errors)) return errors;
  }
  return [];
}

export function errorMessage(e: unknown): string {
  const errors = errorsOf(e);
  if (errors.length > 0) return errors[0].message ?? 'Request failed';
  if (e instanceof Error) return e.message;
  return String(e);
}

// True when the server rejected a write because it already has a newer version.
export function isConflict(e: unknown): boolean {
  return errorsOf(e).some(
    (err) =>
      err.errorType === 'Conflict' ||
      /newer version|changed more recently/i.test(err.message ?? ''),
  );
}

// ---------- API calls ----------
export async function myHouseholds(): Promise<Membership[]> {
  const data = await gql<{ myHouseholds: Membership[] }>(MY_HOUSEHOLDS);
  return data.myHouseholds;
}

export async function createHousehold(name: string, displayName: string): Promise<string> {
  const data = await gql<{ createHousehold: { id: string } }>(CREATE_HOUSEHOLD, {
    name,
    displayName,
  });
  return data.createHousehold.id;
}

export async function joinHousehold(inviteCode: string, displayName: string): Promise<string> {
  const data = await gql<{ joinHousehold: { householdId: string } }>(JOIN_HOUSEHOLD, {
    inviteCode,
    displayName,
  });
  return data.joinHousehold.householdId;
}

export async function householdMembers(householdId: string): Promise<Member[]> {
  const data = await gql<{ householdMembers: Member[] }>(HOUSEHOLD_MEMBERS, { householdId });
  return data.householdMembers;
}

export async function listItems(householdId: string): Promise<Item[]> {
  const data = await gql<{ listItems: Item[] }>(LIST_ITEMS, { householdId });
  return data.listItems;
}

export async function upsertItem(item: Item): Promise<Item> {
  const input = {
    householdId: item.householdId,
    id: item.id,
    name: item.name,
    qty: item.qty,
    category: item.category,
    checked: item.checked,
    assignedTo: item.assignedTo,
    updatedAt: item.updatedAt,
  };
  const data = await gql<{ upsertItem: Item }>(UPSERT_ITEM, { input });
  return data.upsertItem;
}

export async function deleteItem(householdId: string, id: string, updatedAt: string): Promise<Item> {
  const data = await gql<{ deleteItem: Item }>(DELETE_ITEM, { householdId, id, updatedAt });
  return data.deleteItem;
}

type Subscription = { unsubscribe(): void };
type Observable<T> = {
  subscribe(observer: { next: (value: T) => void; error?: (e: unknown) => void }): Subscription;
};

// Live updates for one household. Returns a function that stops listening.
export function subscribeToItems(
  householdId: string,
  onItem: (item: Item) => void,
  onError: (e: unknown) => void,
): () => void {
  const observable = client.graphql({
    query: ON_ITEM_CHANGED,
    variables: { householdId },
  }) as unknown as Observable<GraphQLResult<{ onItemChanged: Item | null }>>;

  const subscription = observable.subscribe({
    next: (message) => {
      const item = message.data?.onItemChanged;
      if (item) onItem(item);
    },
    error: onError,
  });

  return () => subscription.unsubscribe();
}
