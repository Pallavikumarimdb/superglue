import { ApiConfig, ExtractConfig, HttpMethod, Integration, RunResult, TransformConfig, Workflow } from '@superglue/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PostgresService } from './postgres.js';

// Mock Postgres client configuration
const testConfig = {
    host: process.env.VITE_POSTGRES_HOST,
    port: parseInt(process.env.VITE_POSTGRES_PORT || '5432'),
    user: process.env.VITE_POSTGRES_USERNAME,
    password: process.env.VITE_POSTGRES_PASSWORD,
    database: process.env.VITE_POSTGRES_DATABASE || 'superglue_test'
};

if (!testConfig.host || !testConfig.user || !testConfig.password) {
    describe('PostgresService (skipped)', () => {
        it.skip('Skipping Postgres tests due to missing configuration', () => {
            console.warn('Postgres configuration is not set. Skipping tests.');
        });
    });
} else {
    describe('PostgresService', () => {
        let store: PostgresService;
        const testOrgId = 'test-org';

        // Create a single connection for all tests
        beforeAll(async () => {
            try {
                store = new PostgresService(testConfig);
                // Table initialization happens once here
            } catch (error) {
                console.error('Failed to connect to Postgres:', error);
                throw error;
            }
        });

        // Clean up after all tests
        afterAll(async () => {
            try {
                await store.disconnect();
            } catch (error) {
                console.error('Failed to disconnect from Postgres:', error);
            }
        });

        // Add this beforeEach to clean up data between test suites
        beforeEach(async () => {
            // Clear all data for the test org
            await store.clearAll(testOrgId);
            
            // Also clean up tenant_info table since clearAll doesn't handle it
            const client = await store['pool'].connect();
            try {
                await client.query('DELETE FROM tenant_info WHERE id = $1', ['default']);
            } finally {
                client.release();
            }
        });

        describe('API Config', () => {
            const testApiConfig: ApiConfig = {
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
                await store.upsertApiConfig({ id: testApiConfig.id, config: testApiConfig, orgId: testOrgId });
                const retrieved = await store.getApiConfig({ id: testApiConfig.id, orgId: testOrgId });
                expect(retrieved).toEqual(testApiConfig);
            });

            it('should list API configs', async () => {
                await store.upsertApiConfig({ id: testApiConfig.id, config: testApiConfig, orgId: testOrgId });
                const { items, total } = await store.listApiConfigs({ limit: 10, offset: 0, orgId: testOrgId });
                expect(items).toHaveLength(1);
                expect(total).toBe(1);
                expect(items[0]).toEqual(testApiConfig);
            });

            it('should delete API configs', async () => {
                await store.upsertApiConfig({ id: testApiConfig.id, config: testApiConfig, orgId: testOrgId });
                await store.deleteApiConfig({ id: testApiConfig.id, orgId: testOrgId });
                const retrieved = await store.getApiConfig({ id: testApiConfig.id, orgId: testOrgId });
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
                await store.upsertExtractConfig({ id: testExtractConfig.id, config: testExtractConfig, orgId: testOrgId });
                const retrieved = await store.getExtractConfig({ id: testExtractConfig.id, orgId: testOrgId });
                expect(retrieved).toEqual(testExtractConfig);
            });

            it('should list extract configs', async () => {
                await store.upsertExtractConfig({ id: testExtractConfig.id, config: testExtractConfig, orgId: testOrgId });
                const { items, total } = await store.listExtractConfigs({ limit: 10, offset: 0, orgId: testOrgId });
                expect(items).toHaveLength(1);
                expect(total).toBe(1);
                expect(items[0]).toEqual(testExtractConfig);
            });

            it('should delete extract configs', async () => {
                await store.upsertExtractConfig({ id: testExtractConfig.id, config: testExtractConfig, orgId: testOrgId });
                await store.deleteExtractConfig({ id: testExtractConfig.id, orgId: testOrgId });
                const retrieved = await store.getExtractConfig({ id: testExtractConfig.id, orgId: testOrgId });
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
                await store.upsertTransformConfig({ id: testTransformConfig.id, config: testTransformConfig, orgId: testOrgId });
                const retrieved = await store.getTransformConfig({ id: testTransformConfig.id, orgId: testOrgId });
                expect(retrieved).toEqual(testTransformConfig);
            });

            it('should list transform configs', async () => {
                await store.upsertTransformConfig({ id: testTransformConfig.id, config: testTransformConfig, orgId: testOrgId });
                const { items, total } = await store.listTransformConfigs({ limit: 10, offset: 0, orgId: testOrgId });
                expect(items).toHaveLength(1);
                expect(total).toBe(1);
                expect(items[0]).toEqual(testTransformConfig);
            });

            it('should delete transform configs', async () => {
                await store.upsertTransformConfig({ id: testTransformConfig.id, config: testTransformConfig, orgId: testOrgId });
                await store.deleteTransformConfig({ id: testTransformConfig.id, orgId: testOrgId });
                const retrieved = await store.getTransformConfig({ id: testTransformConfig.id, orgId: testOrgId });
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
                await store.createRun({ result: testRun, orgId: testOrgId });
                const retrieved = await store.getRun({ id: testRun.id, orgId: testOrgId });
                expect(retrieved?.id).toEqual(testRun.id);
                expect(retrieved?.success).toEqual(testRun.success);
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

                await store.createRun({ result: run1, orgId: testOrgId });
                await store.createRun({ result: run2, orgId: testOrgId });

                const { items, total } = await store.listRuns({ limit: 10, offset: 0, configId: null, orgId: testOrgId });
                expect(items).toHaveLength(2);
                expect(total).toBe(2);
                expect(items[0].id).toBe(run2.id); // Most recent first
                expect(items[1].id).toBe(run1.id);
            });

            it('should delete runs', async () => {
                await store.createRun({ result: testRun, orgId: testOrgId });
                await store.deleteRun({ id: testRun.id, orgId: testOrgId });
                const retrieved = await store.getRun({ id: testRun.id, orgId: testOrgId });
                expect(retrieved).toBeNull();
            });

            it('should list runs filtered by config ID', async () => {
                const run1 = { ...testRun, id: 'run1', config: { ...testRun.config, id: 'config1' } };
                const run2 = { ...testRun, id: 'run2', config: { ...testRun.config, id: 'config2' } };
                const run3 = { ...testRun, id: 'run3', config: { ...testRun.config, id: 'config1' } };

                await store.createRun({ result: run1, orgId: testOrgId });
                await store.createRun({ result: run2, orgId: testOrgId });
                await store.createRun({ result: run3, orgId: testOrgId });

                const { items, total } = await store.listRuns({ limit: 10, offset: 0, configId: 'config1', orgId: testOrgId });
                expect(items.length).toBe(2);
                expect(total).toBe(2);
                expect(items.map(run => run.id).sort()).toEqual(['run1', 'run3']);
            });
        });

        describe('Integration', () => {
            const testIntegration: Integration = {
                id: 'test-int-id',
                name: 'Test Integration',
                urlHost: 'https://integration.test',
                credentials: { apiKey: 'secret' },
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            it('should store and retrieve integrations', async () => {
                await store.upsertIntegration({ id: testIntegration.id, integration: testIntegration, orgId: testOrgId });
                const retrieved = await store.getIntegration({ id: testIntegration.id, includeDocs: true, orgId: testOrgId });
                expect(retrieved).toMatchObject({ ...testIntegration, id: testIntegration.id });
            });

            it('should list integrations', async () => {
                await store.upsertIntegration({ id: testIntegration.id, integration: testIntegration, orgId: testOrgId });
                const { items, total } = await store.listIntegrations({ limit: 10, offset: 0, includeDocs: true, orgId: testOrgId });
                expect(items).toHaveLength(1);
                expect(total).toBe(1);
                expect(items[0]).toMatchObject({ ...testIntegration, id: testIntegration.id });
            });

            it('should delete integrations', async () => {
                await store.upsertIntegration({ id: testIntegration.id, integration: testIntegration, orgId: testOrgId });
                await store.deleteIntegration({ id: testIntegration.id, orgId: testOrgId });
                const retrieved = await store.getIntegration({ id: testIntegration.id, includeDocs: true, orgId: testOrgId });
                expect(retrieved).toBeNull();
            });

            it('should return null for missing integration', async () => {
                const retrieved = await store.getIntegration({ id: 'does-not-exist', includeDocs: true, orgId: testOrgId });
                expect(retrieved).toBeNull();
            });

            it('should get many integrations by ids, skipping missing ones', async () => {
                const int2 = { ...testIntegration, id: 'test-int-id-2', name: 'Integration 2' };
                await store.upsertIntegration({ id: testIntegration.id, integration: testIntegration, orgId: testOrgId });
                await store.upsertIntegration({ id: int2.id, integration: int2, orgId: testOrgId });
                const result = await store.getManyIntegrations({
                    ids: [testIntegration.id, int2.id, 'missing-id'],
                    orgId: testOrgId
                });
                expect(result).toHaveLength(2);
                expect(result.map(i => i.id).sort()).toEqual([testIntegration.id, int2.id].sort());
            });
        });

        describe('Workflow', () => {
            const testWorkflow: Workflow = {
                id: 'test-workflow-id',
                createdAt: new Date(),
                updatedAt: new Date(),
                instruction: 'Test workflow',
                steps: [],
                inputSchema: {}
            };

            it('should store and retrieve workflows', async () => {
                await store.upsertWorkflow({ id: testWorkflow.id, workflow: testWorkflow, orgId: testOrgId });
                const retrieved = await store.getWorkflow({ id: testWorkflow.id, orgId: testOrgId });
                expect(retrieved).toEqual(testWorkflow);
            });

            it('should list workflows', async () => {
                await store.upsertWorkflow({ id: testWorkflow.id, workflow: testWorkflow, orgId: testOrgId });
                const { items, total } = await store.listWorkflows({ limit: 10, offset: 0, orgId: testOrgId });
                expect(items).toHaveLength(1);
                expect(total).toBe(1);
                expect(items[0]).toEqual(testWorkflow);
            });

            it('should delete workflows', async () => {
                await store.upsertWorkflow({ id: testWorkflow.id, workflow: testWorkflow, orgId: testOrgId });
                await store.deleteWorkflow({ id: testWorkflow.id, orgId: testOrgId });
                const retrieved = await store.getWorkflow({ id: testWorkflow.id, orgId: testOrgId });
                expect(retrieved).toBeNull();
            });

            it('should return null for missing workflow', async () => {
                const retrieved = await store.getWorkflow({ id: 'does-not-exist', orgId: testOrgId });
                expect(retrieved).toBeNull();
            });

            it('should get many workflows by ids, skipping missing ones', async () => {
                const wf2 = { ...testWorkflow, id: 'test-workflow-id-2' };
                await store.upsertWorkflow({ id: testWorkflow.id, workflow: testWorkflow, orgId: testOrgId });
                await store.upsertWorkflow({ id: wf2.id, workflow: wf2, orgId: testOrgId });
                const result = await store.getManyWorkflows({
                    ids: [testWorkflow.id, wf2.id, 'missing-id'],
                    orgId: testOrgId
                });
                expect(result).toHaveLength(2);
                expect(result.map(w => w.id).sort()).toEqual([testWorkflow.id, wf2.id].sort());
            });
        });

        describe('Tenant Info', () => {
            it('should set and get tenant info', async () => {
                await store.setTenantInfo({ email: 'test@example.com', emailEntrySkipped: false });
                const info = await store.getTenantInfo();
                expect(info.email).toBe('test@example.com');
                expect(info.emailEntrySkipped).toBe(false);
            });

            it('should update only specified fields', async () => {
                await store.setTenantInfo({ email: 'test@example.com', emailEntrySkipped: false });
                await store.setTenantInfo({ emailEntrySkipped: true });
                const info = await store.getTenantInfo();
                expect(info.email).toBe('test@example.com');
                expect(info.emailEntrySkipped).toBe(true);
            });

            it('should handle null email', async () => {
                await store.setTenantInfo({ email: null, emailEntrySkipped: true });
                const info = await store.getTenantInfo();
                expect(info.email).toBeNull();
                expect(info.emailEntrySkipped).toBe(true);
            });
        });

        describe('Health Check', () => {
            it('should return true when postgres is connected', async () => {
                const result = await store.ping();
                expect(result).toBe(true);
            });
        });
    });
} 