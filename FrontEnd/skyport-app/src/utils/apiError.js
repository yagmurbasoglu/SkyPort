const stringifyValidationError = (detail) => {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          const fieldPath = Array.isArray(item.loc) ? item.loc.slice(1).join('.') : '';
          const base = typeof item.msg === 'string' ? item.msg : JSON.stringify(item);
          return fieldPath ? `${fieldPath}: ${base}` : base;
        }
        return null;
      })
      .filter(Boolean);
    return messages.join(' | ');
  }
  if (detail && typeof detail === 'object') {
    if (typeof detail.message === 'string') return detail.message;
    return JSON.stringify(detail);
  }
  return '';
};

export const getApiErrorMessage = (error, fallback = 'Request failed.') => {
  const responseData = error?.response?.data;
  const directMessage = responseData?.message;
  if (typeof directMessage === 'string' && directMessage.trim()) return directMessage;

  const detailMessage = stringifyValidationError(responseData?.detail);
  if (detailMessage) return detailMessage;

  if (typeof error?.message === 'string' && error.message.trim()) return error.message;
  return fallback;
};

export default getApiErrorMessage;
