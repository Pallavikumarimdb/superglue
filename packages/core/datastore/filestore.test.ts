import { ApiConfig, ExtractConfig, HttpMethod, RunResult, TransformConfig } from '@superglue/client';
import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileStore } from './filestore.js';

describe('FileStore', () => {
  let store: FileStore;
  const testOrgId = 'test-org';
  const testDir = './.test-data';
  const testLogsPath = path.join(testDir, 'superglue_logs.jsonl');
  const testPath = path.join(testDir, 'superglue_data.json');

  beforeEach(() => {
    // Clean up any existing test data
    if (fs.existsSync(testPath)) {
      fs.unlinkSync(testPath);
    }
    if (fs.existsSync(testLogsPath)) {
      fs.unlinkSync(testLogsPath);
    }
    if (fs.existsSync(testDir)) {
      fs.rmdirSync(testDir);
    }
    // Clear the DISABLE_LOGS environment variable for tests
    delete process.env.DISABLE_LOGS;
    store = new FileStore(testDir);
  });

  afterEach(async () => {
    await store.clearAll();
    await store.disconnect();
    // Clean up test files
    if (fs.existsSync(testPath)) {
      fs.unlinkSync(testPath);
    }
    if (fs.existsSync(testLogsPath)) {
      fs.unlinkSync(testLogsPath);
    }
    if (fs.existsSync(testDir)) {
      fs.rmdirSync(testDir);
    }
    // Clean up environment variable
    delete process.env.DISABLE_LOGS;
  });

  describe('API Config', () => {
    const testConfig: ApiConfig = {
      id: 'test-id',
      createdAt: new Date(),
      updatedAt: new Date(),
      urlHost: 'https://test.com',
      method: HttpMethod.GET,
      headers: {},
      queryParams: {},
      instruction: 'Test API',
    };

    it('should store and retrieve API configs', async () => {
      await store.upsertApiConfig(testConfig.id, testConfig, testOrgId);
      const retrieved = await store.getApiConfig(testConfig.id, testOrgId);
      expect(retrieved).toEqual(testConfig);
    });

    it('should list API configs', async () => {
      await store.upsertApiConfig(testConfig.id, testConfig, testOrgId);
      const { items, total } = await store.listApiConfigs(10, 0, testOrgId);
      expect(items).toHaveLength(1);
      expect(total).toBe(1);
      expect(items[0]).toEqual(testConfig);
    });

    it('should delete API configs', async () => {
      await store.upsertApiConfig(testConfig.id, testConfig, testOrgId);
      await store.deleteApiConfig(testConfig.id, testOrgId);
      const retrieved = await store.getApiConfig(testConfig.id, testOrgId);
      expect(retrieved).toBeNull();
    });
  });

  describe('Extract Config', () => {
    const testExtractConfig: ExtractConfig = {
      id: 'test-extract-id',
      createdAt: new Date(),
      updatedAt: new Date(),
      instruction: 'Test extraction',
      urlHost: 'https://test.com',
    };

    it('should store and retrieve extract configs', async () => {
      await store.upsertExtractConfig(testExtractConfig.id, testExtractConfig, testOrgId);
      const retrieved = await store.getExtractConfig(testExtractConfig.id, testOrgId);
      expect(retrieved).toEqual(testExtractConfig);
    });

    it('should list extract configs', async () => {
      await store.upsertExtractConfig(testExtractConfig.id, testExtractConfig, testOrgId);
      const { items, total } = await store.listExtractConfigs(10, 0, testOrgId);
      expect(items).toHaveLength(1);
      expect(total).toBe(1);
      expect(items[0]).toEqual(testExtractConfig);
    });

    it('should delete extract configs', async () => {
      await store.upsertExtractConfig(testExtractConfig.id, testExtractConfig, testOrgId);
      await store.deleteExtractConfig(testExtractConfig.id, testOrgId);
      const retrieved = await store.getExtractConfig(testExtractConfig.id, testOrgId);
      expect(retrieved).toBeNull();
    });
  });

  describe('Transform Config', () => {
    const testTransformConfig: TransformConfig = {
      id: 'test-transform-id',
      createdAt: new Date(),
      updatedAt: new Date(),
      instruction: 'Test transformation',
      responseSchema: {},
      responseMapping: ''
    };

    it('should store and retrieve transform configs', async () => {
      await store.upsertTransformConfig(testTransformConfig.id, testTransformConfig, testOrgId);
      const retrieved = await store.getTransformConfig(testTransformConfig.id, testOrgId);
      expect(retrieved).toEqual(testTransformConfig);
    });

    it('should list transform configs', async () => {
      await store.upsertTransformConfig(testTransformConfig.id, testTransformConfig, testOrgId);
      const { items, total } = await store.listTransformConfigs(10, 0, testOrgId);
      expect(items).toHaveLength(1);
      expect(total).toBe(1);
      expect(items[0]).toEqual(testTransformConfig);
    });

    it('should delete transform configs', async () => {
      await store.upsertTransformConfig(testTransformConfig.id, testTransformConfig, testOrgId);
      await store.deleteTransformConfig(testTransformConfig.id, testOrgId);
      const retrieved = await store.getTransformConfig(testTransformConfig.id, testOrgId);
      expect(retrieved).toBeNull();
    });
  });

  describe('Run Results', () => {
    const testApiConfig: ApiConfig = {
      id: 'test-api-id',
      createdAt: new Date(),
      updatedAt: new Date(),
      urlHost: 'https://test.com',
      method: HttpMethod.GET,
      headers: {},
      queryParams: {},
      instruction: 'Test API',
    };

    const testRun: RunResult = {
      id: 'test-run-id',
      startedAt: new Date(),
      completedAt: new Date(),
      success: true,
      config: testApiConfig,
      error: null,
    };

    it('should store and retrieve runs', async () => {
      await store.createRun(testRun, testOrgId);
      const retrieved = await store.getRun(testRun.id, testOrgId);
      expect(retrieved).toEqual(testRun);
    });

    it('should list runs in chronological order', async () => {
      const run1: RunResult = {
        ...testRun,
        id: 'run1',
        startedAt: new Date(Date.now() - 1000),
      };
      const run2: RunResult = {
        ...testRun,
        id: 'run2',
        startedAt: new Date(),
      };

      await store.createRun(run1, testOrgId);
      await store.createRun(run2, testOrgId);

      const { items, total } = await store.listRuns(10, 0, null, testOrgId);
      expect(items).toHaveLength(2);
      expect(total).toBe(2);
      expect(items[0].id).toBe(run2.id); // Most recent first
      expect(items[1].id).toBe(run1.id);
    });

    it('should delete runs', async () => {
      await store.createRun(testRun, testOrgId);
      await store.deleteRun(testRun.id, testOrgId);
      const retrieved = await store.getRun(testRun.id, testOrgId);
      expect(retrieved).toBeNull();
    });

    it('should list runs filtered by config ID', async () => {
      const run1 = { ...testRun, id: 'run1', config: { ...testRun.config, id: 'config1' } };
      const run2 = { ...testRun, id: 'run2', config: { ...testRun.config, id: 'config2' } };
      const run3 = { ...testRun, id: 'run3', config: { ...testRun.config, id: 'config1' } };

      await store.createRun(run1, testOrgId);
      await store.createRun(run2, testOrgId);
      await store.createRun(run3, testOrgId);

      const { items, total } = await store.listRuns(10, 0, 'config1', testOrgId);
      expect(items.length).toBe(2);
      expect(total).toBe(2); // Total should match filtered results since we changed the implementation
      expect(items.map(run => run.id).sort()).toEqual(['run1', 'run3']);
    });

    it('should persist data between store instances', async () => {
      await store.createRun(testRun, testOrgId);
      await store.disconnect();

      // Create a new store instance pointing to the same directory
      const newStore = new FileStore(testDir);
      const retrieved = await newStore.getRun(testRun.id, testOrgId);
      expect(retrieved).toEqual(testRun);
    });

    it('should not log runs when DISABLE_LOGS is set', async () => {
      process.env.DISABLE_LOGS = 'true';
      const storeWithDisabledLogs = new FileStore(testDir);

      await storeWithDisabledLogs.createRun(testRun, testOrgId);

      // With DISABLE_LOGS set, the run should not be logged to file
      // but retrieval will fail since it's not persisted anywhere
      const retrieved = await storeWithDisabledLogs.getRun(testRun.id, testOrgId);
      expect(retrieved).toBeNull();
    });

    it('should filter out corrupted runs and continue listing valid ones', async () => {
      // Create a valid run
      const validRun = { ...testRun, id: 'valid-run' };
      await store.createRun(validRun, testOrgId);

      // Manually append corrupted JSON lines to the logs file to simulate corruption
      const corruptedLines = [
        '{"id":"corrupted-run-1","config":null,"startedAt":null}\n',
        '{"id":"corrupted-run-2","config":{"id":"config-id"},"startedAt":null}\n',
        '{"id":"corrupted-run-3","config":null,"startedAt":"2023-01-01T00:00:00.000Z"}\n',
        'invalid json line\n',
        '{"id":"corrupted-run-4","config":{"id":"config-id"},"startedAt":"not-a-date"}\n'
      ];

      await fs.promises.appendFile(testLogsPath, corruptedLines.join(''));

      const { items, total } = await store.listRuns(10, 0, null, testOrgId);

      // Should only return the valid run
      expect(items.length).toBe(1);
      expect(total).toBe(1);
      expect(items[0].id).toBe('valid-run');
    });

    it('should handle runs with missing startedAt dates', async () => {
      const runWithoutStartedAt = {
        ...testRun,
        id: 'run-no-started-at',
        startedAt: undefined
      };
      const validRun = { ...testRun, id: 'valid-run' };

      await store.createRun(runWithoutStartedAt, testOrgId);
      await store.createRun(validRun, testOrgId);

      const { items, total } = await store.listRuns(10, 0, null, testOrgId);

      // Should only return the valid run
      expect(items.length).toBe(1);
      expect(total).toBe(1);
      expect(items[0].id).toBe('valid-run');
    });

    it('should handle runs with missing config IDs', async () => {
      const runWithoutConfigId = {
        ...testRun,
        id: 'run-no-config-id',
        config: { ...testRun.config, id: undefined }
      };
      const validRun = { ...testRun, id: 'valid-run' };

      await store.createRun(runWithoutConfigId, testOrgId);
      await store.createRun(validRun, testOrgId);

      const { items, total } = await store.listRuns(10, 0, null, testOrgId);

      // Should only return the valid run
      expect(items.length).toBe(1);
      expect(total).toBe(1);
      expect(items[0].id).toBe('valid-run');
    });

  });

  describe('Integration', () => {
    const testIntegration = {
      id: 'test-int-id',
      name: 'Test Integration',
      urlHost: 'https://integration.test',
      credentials: { apiKey: 'secret' },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should store and retrieve integrations', async () => {
      await store.upsertIntegration(testIntegration.id, testIntegration, testOrgId);
      const retrieved = await store.getIntegration(testIntegration.id, testOrgId);
      expect(retrieved).toEqual({ ...testIntegration, id: testIntegration.id });
    });

    it('should list integrations', async () => {
      await store.upsertIntegration(testIntegration.id, testIntegration, testOrgId);
      const { items, total } = await store.listIntegrations(10, 0, testOrgId);
      expect(items).toHaveLength(1);
      expect(total).toBe(1);
      expect(items[0]).toEqual({ ...testIntegration, id: testIntegration.id });
    });

    it('should delete integrations', async () => {
      await store.upsertIntegration(testIntegration.id, testIntegration, testOrgId);
      await store.deleteIntegration(testIntegration.id, testOrgId);
      const retrieved = await store.getIntegration(testIntegration.id, testOrgId);
      expect(retrieved).toBeNull();
    });

    it('should return null for missing integration', async () => {
      const retrieved = await store.getIntegration('does-not-exist', testOrgId);
      expect(retrieved).toBeNull();
    });

    it('should get many integrations by ids, skipping missing ones', async () => {
      const int2 = { ...testIntegration, id: 'test-int-id-2', name: 'Integration 2' };
      await store.upsertIntegration(testIntegration.id, testIntegration, testOrgId);
      await store.upsertIntegration(int2.id, int2, testOrgId);
      const result = await store.getManyIntegrations([
        testIntegration.id,
        int2.id,
        'missing-id'
      ], testOrgId);
      expect(result).toHaveLength(2);
      expect(result.map(i => i.id).sort()).toEqual([testIntegration.id, int2.id].sort());
    });
  });

  describe('Workflow', () => {
    const testWorkflow = {
      id: 'test-workflow-id',
      steps: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should get many workflows by ids, skipping missing ones', async () => {
      const wf2 = { ...testWorkflow, id: 'test-workflow-id-2' };
      await store.upsertWorkflow(testWorkflow.id, testWorkflow, testOrgId);
      await store.upsertWorkflow(wf2.id, wf2, testOrgId);
      const result = await store.getManyWorkflows([
        testWorkflow.id,
        wf2.id,
        'missing-id'
      ], testOrgId);
      expect(result).toHaveLength(2);
      expect(result.map(w => w.id).sort()).toEqual([testWorkflow.id, wf2.id].sort());
    });
  });

  describe('Clear All', () => {
    it('should clear all data', async () => {
      const testConfig: ApiConfig = {
        id: 'test-api',
        createdAt: new Date(),
        updatedAt: new Date(),
        urlHost: 'https://test.com',
        method: HttpMethod.GET,
        headers: {},
        queryParams: {},
        instruction: 'Test API',
      };

      const testExtractConfig: ExtractConfig = {
        id: 'test-extract',
        createdAt: new Date(),
        updatedAt: new Date(),
        instruction: 'Test extraction',
        urlHost: 'https://test.com',
      };

      const testTransformConfig: TransformConfig = {
        id: 'test-transform',
        createdAt: new Date(),
        updatedAt: new Date(),
        instruction: 'Test transformation',
        responseSchema: {},
        responseMapping: ''
      };

      const testRun: RunResult = {
        id: 'test-run',
        startedAt: new Date(),
        completedAt: new Date(),
        success: true,
        config: testConfig,
        error: null,
      };

      const testIntegration = {
        id: 'test-int-id',
        name: 'Test Integration',
        urlHost: 'https://integration.test',
        credentials: { apiKey: 'secret' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await store.upsertApiConfig('test-api', testConfig, testOrgId);
      await store.upsertExtractConfig('test-extract', testExtractConfig, testOrgId);
      await store.upsertTransformConfig('test-transform', testTransformConfig, testOrgId);
      await store.createRun(testRun, testOrgId);
      await store.upsertIntegration(testIntegration.id, testIntegration, testOrgId);

      await store.clearAll();

      const { total: apiTotal } = await store.listApiConfigs(10, 0, testOrgId);
      const { total: extractTotal } = await store.listExtractConfigs(10, 0, testOrgId);
      const { total: transformTotal } = await store.listTransformConfigs(10, 0, testOrgId);
      const { total: runTotal } = await store.listRuns(10, 0, null, testOrgId);
      const { total: integrationTotal } = await store.listIntegrations(10, 0, testOrgId);

      expect(apiTotal).toBe(0);
      expect(extractTotal).toBe(0);
      expect(transformTotal).toBe(0);
      expect(runTotal).toBe(0);
      expect(integrationTotal).toBe(0);
    });
  });
});
