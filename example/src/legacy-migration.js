// Example-only adapter. Unexpected errors must still reach the caller.
export function compareLegacyOrExplain(compare) {
  try {
    return {status: 'available', node: compare()}
  } catch (error) {
    if (!(error instanceof RangeError) ||
        !error.message.startsWith('Diff output cannot be represented in the original schema:') ||
        !(error.cause instanceof RangeError)) throw error
    return {status: 'unrepresentable', message:
      'A combined marked document cannot represent this change. Both original versions remain available below; no source formatting was removed.'}
  }
}
