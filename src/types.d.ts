interface ObjectConstructor {
  fromEntries(entries: Iterable<readonly [PropertyKey, unknown]>): any;
}
