// Runs when a client subscribes. The checkMembership function before this
// rejects anyone who isn't in the household. Subscription resolvers return null.
export function request(ctx) {
  return {};
}

export function response(ctx) {
  return null;
}
