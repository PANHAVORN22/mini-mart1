export async function runWithTimeout<T>(
  operation: () => PromiseLike<T>,
  label: string,
  timeoutMs = 10000
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} request timed out`));
    }, timeoutMs);
  });

  try {
    const operationPromise = Promise.resolve().then(operation);
    return (await Promise.race([operationPromise, timeoutPromise])) as T;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
