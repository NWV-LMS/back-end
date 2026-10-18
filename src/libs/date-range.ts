export interface DateRangeFilter {
  gte?: Date;
  lte?: Date;
  lt?: Date;
}

export function buildDateRangeFilter(
  from?: string | Date,
  to?: string | Date,
): DateRangeFilter {
  const filter: DateRangeFilter = {};
  if (from) {
    filter.gte = new Date(typeof from === 'string' ? from : from.getTime());
  }
  if (to) {
    const end = new Date(typeof to === 'string' ? to : to.getTime());
    if (typeof to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      // A date-only upper bound includes the entire UTC calendar day.
      end.setUTCDate(end.getUTCDate() + 1);
      filter.lt = end;
    } else {
      filter.lte = end;
    }
  }
  return filter;
}
