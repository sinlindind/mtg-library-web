export const normalizeTags = (rawTags) => {
  if (!rawTags) return [];

  if (Array.isArray(rawTags)) {
    return rawTags
      .map((t) => String(t).trim().toLowerCase())
      .filter((t) => t.length > 0);
  }

  if (typeof rawTags === 'string') {
    try {
      const parsed = JSON.parse(rawTags);
      if (Array.isArray(parsed)) {
        return parsed
          .map((t) => String(t).trim().toLowerCase())
          .filter((t) => t.length > 0);
      }
    } catch {
      return rawTags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0);
    }
  }
  return [];
};