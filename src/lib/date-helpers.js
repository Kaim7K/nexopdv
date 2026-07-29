export const todayIsoDate = () => new Date().toISOString().slice(0, 10);

export const monthStartIsoDate = () => `${todayIsoDate().slice(0, 8)}01`;

export const toInputDate = (value) => (value ? String(value).slice(0, 10) : '');

export const toDateTimeStart = (value) => (value ? `${value}T00:00:00` : '');

export const toExclusiveDateTimeEnd = (value) => {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return date.toISOString();
};
