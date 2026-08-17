export function createQueryParams(required = {}, optional = {}) {
  const params = new URLSearchParams(
    Object.fromEntries(
      Object.entries(required).map(([key, value]) => [key, String(value)]),
    ),
  );

  for (const [key, value] of Object.entries(optional)) {
    if (value !== '' && value !== null && value !== undefined && value !== false) {
      params.set(key, String(value));
    }
  }

  return params;
}
