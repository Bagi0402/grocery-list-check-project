// Wraps every Query/Mutation pipeline.
// Returns stash.output if a function set it, otherwise the last function's result.
export function request(ctx) {
  return {};
}

export function response(ctx) {
  return ctx.stash.output ? ctx.stash.output : ctx.prev.result;
}
