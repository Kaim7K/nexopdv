interface ObjectConstructor {
  fromEntries(entries: Iterable<readonly [PropertyKey, unknown]>): any;
}

interface Window {
  google?: any;
  __gcse?: any;
  __nexoGoogleImageSearchReady?: () => void;
  __nexoGoogleImageResultsReady?: (...args: any[]) => boolean;
}
