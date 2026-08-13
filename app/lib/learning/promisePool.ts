export async function allSettledWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError("concurrency must be a positive integer");
  }

  const settled: Array<PromiseSettledResult<R> | undefined> = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;

      try {
        const value = await task(items[index], index);
        settled[index] = { status: "fulfilled", value };
      } catch (reason) {
        settled[index] = { status: "rejected", reason };
      }
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return settled.map((result) => {
    if (!result) throw new Error("Promise pool finished without a result");
    return result;
  });
}
