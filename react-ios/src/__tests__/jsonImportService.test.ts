// Mock expo-crypto
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('mock-uuid'),
}));

// Mock the database
const mockRunAsync = jest.fn();
const mockExecAsync = jest.fn();
const mockGetFirstAsync = jest.fn();
const mockGetAllAsync = jest.fn();

jest.mock('@/db/index', () => ({
  getDatabase: jest.fn().mockResolvedValue({
    runAsync: mockRunAsync,
    execAsync: mockExecAsync,
    getFirstAsync: mockGetFirstAsync,
    getAllAsync: mockGetAllAsync,
  }),
}));

import {
  importUnifiedJson,
  previewUnifiedJson,
  importResultSummary,
  JsonImportError,
} from '../services/jsonImportService';

// ============================================================================
// Test Data Helpers
// ============================================================================

const sampleUnifiedExport = {
  formatVersion: '1.0',
  exportedAt: '2026-02-20T10:30:00Z',
  appVersion: '1.0.0',
  plans: [{
    name: 'Push Day',
    description: 'A push workout',
    tags: ['push', 'chest'],
    defaultWeightUnit: 'lbs',
    sourceMarkdown: '# Push Day',
    isFavorite: true,
    exercises: [{
      exerciseName: 'Bench Press',
      orderIndex: 0,
      notes: 'Focus on form',
      equipmentType: 'barbell',
      sets: [{
        orderIndex: 0,
        targetWeight: 135,
        targetWeightUnit: 'lbs',
        targetReps: 10,
        restSeconds: 90,
        isDropset: false,
        isPerSide: false,
      }],
    }],
  }],
  sessions: [{
    name: 'Push Day',
    date: '2026-02-15',
    startTime: '2026-02-15T14:00:00Z',
    endTime: '2026-02-15T15:15:00Z',
    duration: 4500,
    notes: 'Good session',
    status: 'completed',
    exercises: [{
      exerciseName: 'Bench Press',
      orderIndex: 0,
      equipmentType: 'barbell',
      status: 'completed',
      sets: [{
        orderIndex: 0,
        targetWeight: 135,
        targetWeightUnit: 'lbs',
        targetReps: 10,
        actualWeight: 135,
        actualWeightUnit: 'lbs',
        actualReps: 10,
        completedAt: '2026-02-15T14:05:00Z',
        status: 'completed',
        isDropset: false,
        isPerSide: false,
      }],
    }],
  }],
  gyms: [{
    name: 'Home Gym',
    isDefault: false,
  }],
  settings: {
    defaultWeightUnit: 'lbs',
    theme: 'dark',
  },
};

// ============================================================================
// Tests
// ============================================================================

describe('previewUnifiedJson', () => {
  it('returns counts of plans, sessions, gyms, and settings', () => {
    const preview = previewUnifiedJson(JSON.stringify(sampleUnifiedExport));
    expect(preview.planCount).toBe(1);
    expect(preview.sessionCount).toBe(1);
    expect(preview.gymCount).toBe(1);
    expect(preview.hasSettings).toBe(true);
  });

  it('counts single session format', () => {
    const data = {
      exportedAt: '2026-02-20T10:30:00Z',
      session: { name: 'Test', date: '2026-02-15' },
    };
    const preview = previewUnifiedJson(JSON.stringify(data));
    expect(preview.sessionCount).toBe(1);
    expect(preview.planCount).toBe(0);
  });

  it('throws on invalid JSON', () => {
    expect(() => previewUnifiedJson('not json')).toThrow(JsonImportError);
    expect(() => previewUnifiedJson('not json')).toThrow('not valid JSON');
  });

  it('throws on JSON with no importable data', () => {
    expect(() => previewUnifiedJson(JSON.stringify({ foo: 'bar' }))).toThrow(JsonImportError);
    expect(() => previewUnifiedJson(JSON.stringify({ foo: 'bar' }))).toThrow('does not contain any importable data');
  });
});

describe('importResultSummary', () => {
  it('returns "No data to import." for empty result', () => {
    const result = {
      plansImported: 0,
      plansSkipped: 0,
      sessionsImported: 0,
      sessionsSkipped: 0,
      gymsImported: 0,
      gymsSkipped: 0,
    };
    expect(importResultSummary(result)).toBe('No data to import.');
  });

  it('summarizes imported and skipped counts', () => {
    const result = {
      plansImported: 2,
      plansSkipped: 1,
      sessionsImported: 5,
      sessionsSkipped: 0,
      gymsImported: 1,
      gymsSkipped: 0,
    };
    const summary = importResultSummary(result);
    expect(summary).toContain('2 plans imported');
    expect(summary).toContain('1 plans skipped (duplicates)');
    expect(summary).toContain('5 sessions imported');
    expect(summary).toContain('1 gyms imported');
    expect(summary).not.toContain('sessions skipped');
  });
});

describe('importUnifiedJson', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no duplicates found
    mockGetFirstAsync.mockResolvedValue({ count: 0 });
  });

  it('throws on invalid JSON', async () => {
    await expect(importUnifiedJson('not json')).rejects.toThrow(JsonImportError);
  });

  it('throws on unsupported format version', async () => {
    const data = { ...sampleUnifiedExport, formatVersion: '2.0' };
    await expect(importUnifiedJson(JSON.stringify(data))).rejects.toThrow('Unsupported format version');
  });

  it('wraps import in a transaction', async () => {
    const result = await importUnifiedJson(JSON.stringify(sampleUnifiedExport));

    expect(mockExecAsync).toHaveBeenCalledWith('BEGIN TRANSACTION');
    expect(mockExecAsync).toHaveBeenCalledWith('COMMIT');
    expect(result.plansImported).toBe(1);
    expect(result.sessionsImported).toBe(1);
    expect(result.gymsImported).toBe(1);
  });

  it('rolls back on error', async () => {
    mockRunAsync.mockRejectedValueOnce(new Error('DB error'));

    await expect(importUnifiedJson(JSON.stringify(sampleUnifiedExport)))
      .rejects.toThrow('DB error');

    expect(mockExecAsync).toHaveBeenCalledWith('BEGIN TRANSACTION');
    expect(mockExecAsync).toHaveBeenCalledWith('ROLLBACK');
  });

  it('skips duplicate plans by name', async () => {
    mockGetFirstAsync.mockResolvedValueOnce({ count: 1 }); // plan exists
    mockGetFirstAsync.mockResolvedValue({ count: 0 }); // rest don't

    const data = {
      ...sampleUnifiedExport,
      sessions: [],
      gyms: [],
    };

    const result = await importUnifiedJson(JSON.stringify(data));
    expect(result.plansSkipped).toBe(1);
    expect(result.plansImported).toBe(0);
  });

  it('skips duplicate sessions by name+date', async () => {
    // First call for plan check -> not found, then session check -> found
    mockGetFirstAsync
      .mockResolvedValueOnce({ count: 0 })  // plan doesn't exist
      .mockResolvedValueOnce({ count: 1 })  // session exists
      .mockResolvedValue({ count: 0 });      // gym doesn't exist

    const result = await importUnifiedJson(JSON.stringify(sampleUnifiedExport));
    expect(result.sessionsSkipped).toBe(1);
    expect(result.sessionsImported).toBe(0);
  });

  it('skips duplicate gyms by name', async () => {
    mockGetFirstAsync
      .mockResolvedValueOnce({ count: 0 }) // plan
      .mockResolvedValueOnce({ count: 0 }) // session
      .mockResolvedValueOnce({ count: 1 }); // gym exists

    const result = await importUnifiedJson(JSON.stringify(sampleUnifiedExport));
    expect(result.gymsSkipped).toBe(1);
    expect(result.gymsImported).toBe(0);
  });

  it('inserts plan with exercises and sets', async () => {
    const data = {
      ...sampleUnifiedExport,
      sessions: [],
      gyms: [],
    };

    await importUnifiedJson(JSON.stringify(data));

    // Should insert: workout_template, template_exercise, template_set
    const insertCalls = mockRunAsync.mock.calls.map(c => c[0] as string);
    expect(insertCalls.some(sql => sql.includes('INSERT INTO workout_templates'))).toBe(true);
    expect(insertCalls.some(sql => sql.includes('INSERT INTO template_exercises'))).toBe(true);
    expect(insertCalls.some(sql => sql.includes('INSERT INTO template_sets'))).toBe(true);

    // Verify template_sets insert does NOT include is_amrap or notes columns
    const templateSetInsert = insertCalls.find(sql => sql.includes('INSERT INTO template_sets'));
    expect(templateSetInsert).not.toContain('is_amrap');
    expect(templateSetInsert).not.toContain('notes');
  });

  it('inserts session with exercises and sets', async () => {
    const data = {
      ...sampleUnifiedExport,
      plans: [],
      gyms: [],
    };

    await importUnifiedJson(JSON.stringify(data));

    const insertCalls = mockRunAsync.mock.calls.map(c => c[0] as string);
    expect(insertCalls.some(sql => sql.includes('INSERT INTO workout_sessions'))).toBe(true);
    expect(insertCalls.some(sql => sql.includes('INSERT INTO session_exercises'))).toBe(true);
    expect(insertCalls.some(sql => sql.includes('INSERT INTO session_sets'))).toBe(true);
  });

  it('handles single session format', async () => {
    const data = {
      exportedAt: '2026-02-20T10:30:00Z',
      appVersion: '1.0.0',
      session: sampleUnifiedExport.sessions[0],
    };

    const result = await importUnifiedJson(JSON.stringify(data));
    expect(result.sessionsImported).toBe(1);
  });

  it('handles missing optional sections gracefully', async () => {
    const data = {
      exportedAt: '2026-02-20T10:30:00Z',
      plans: [],
      sessions: [],
    };

    const result = await importUnifiedJson(JSON.stringify(data));
    expect(result.plansImported).toBe(0);
    expect(result.sessionsImported).toBe(0);
    expect(result.gymsImported).toBe(0);
  });

  it('skips entries without required name field', async () => {
    const data = {
      plans: [{ description: 'no name' }],
      sessions: [{ date: '2026-01-01' }], // no name
      gyms: [{ isDefault: false }], // no name
    };

    const result = await importUnifiedJson(JSON.stringify(data));
    expect(result.plansImported).toBe(0);
    expect(result.sessionsImported).toBe(0);
    expect(result.gymsImported).toBe(0);
  });

  it('defaults session status to completed', async () => {
    const data = {
      sessions: [{
        name: 'Test',
        date: '2026-01-01',
        exercises: [],
      }],
    };

    await importUnifiedJson(JSON.stringify(data));

    const sessionInsert = mockRunAsync.mock.calls.find(
      c => (c[0] as string).includes('INSERT INTO workout_sessions')
    );
    expect(sessionInsert).toBeDefined();
    // Last arg in the values array should be 'completed'
    const args = sessionInsert![1] as unknown[];
    expect(args[args.length - 1]).toBe('completed');
  });
});
