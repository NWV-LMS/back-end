import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { buildDateRangeFilter } from './date-range';
import { QueryExpenseDto } from './dto/expense/query-expense.dto';
import { FinanceQueryDto } from './dto/finance/finance-query.dto';
import { QueryPaymentDto } from './dto/payment/query-payment.dto';

describe('financial date range validation', () => {
  describe.each([
    ['finance', FinanceQueryDto],
    ['payments', QueryPaymentDto],
    ['expenses', QueryExpenseDto],
  ] as const)('%s queries', (_name, Dto) => {
    it.each([
      'not-a-date',
      '',
      '2026-02-30',
      '2026-W25',
      '2026-287',
      '2026-06-15T25:00:00Z',
      '2026-06-15T12',
      '2026-06-15T1230',
      '2026-06-15T12:30:00+06',
      '2026-06-15T12:30:00,123Z',
    ])('rejects invalid or unsupported dates: %s', async (value) => {
      const query = plainToInstance(Dto, { from: value, to: value });

      const errors = await validate(query);

      expect(errors.map((error) => error.property).sort()).toEqual([
        'from',
        'to',
      ]);
    });

    it.each([
      '2024-02-29',
      '2026-06-15',
      '2026-06-15T12:30',
      '2026-06-15T12:30:00Z',
      '2026-06-15T12:30:00+06:00',
      '2026-06-15T12:30:00+0600',
    ])('accepts calendar dates and ISO timestamps: %s', async (value) => {
      const query = plainToInstance(Dto, { from: value, to: value });

      expect(await validate(query)).toEqual([]);
    });

    it('allows an omitted date range', async () => {
      expect(await validate(new Dto())).toEqual([]);
    });
  });
});

describe('buildDateRangeFilter', () => {
  it('includes the entire requested calendar day and excludes the next day', () => {
    const filter = buildDateRangeFilter('2026-06-15', '2026-06-15');

    expect(filter).toEqual({
      gte: new Date('2026-06-15T00:00:00.000Z'),
      lt: new Date('2026-06-16T00:00:00.000Z'),
    });
    expect(new Date('2026-06-15T23:59:59.999Z').getTime()).toBeLessThan(
      filter.lt!.getTime(),
    );
  });

  it('handles a year boundary in UTC', () => {
    expect(buildDateRangeFilter(undefined, '2026-12-31')).toEqual({
      lt: new Date('2027-01-01T00:00:00.000Z'),
    });
  });

  it('preserves the exact inclusive timestamp and timezone offset', () => {
    expect(
      buildDateRangeFilter(
        '2026-06-15T09:00:00+06:00',
        '2026-06-15T12:30:00+06:00',
      ),
    ).toEqual({
      gte: new Date('2026-06-15T03:00:00.000Z'),
      lte: new Date('2026-06-15T06:30:00.000Z'),
    });
  });

  it('preserves Date defaults without changing the supplied Date object', () => {
    const end = new Date('2026-06-15T12:30:00.000Z');

    const filter = buildDateRangeFilter(undefined, end);

    expect(filter).toEqual({ lte: end });
    expect(filter.lte).not.toBe(end);
    expect(end.toISOString()).toBe('2026-06-15T12:30:00.000Z');
  });

  it('allows an unbounded range', () => {
    expect(buildDateRangeFilter()).toEqual({});
  });
});
