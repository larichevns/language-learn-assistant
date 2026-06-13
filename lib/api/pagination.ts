export interface Pagination {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export function parsePagination(url: URL, defaultSize = 20, maxSize = 100): Pagination {
  const page = Math.max(1, Math.floor(Number(url.searchParams.get('page') ?? '1')) || 1);
  const rawSize = Math.floor(Number(url.searchParams.get('pageSize') ?? defaultSize)) || defaultSize;
  const pageSize = Math.min(maxSize, Math.max(1, rawSize));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function listResult<T>(items: T[], total: number, p: Pagination) {
  return {
    items,
    total,
    page: p.page,
    pageSize: p.pageSize,
    hasNext: p.page * p.pageSize < total,
  };
}
