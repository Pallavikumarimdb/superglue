import type { Integration } from '@superglue/client';
import { getOAuthTokenUrl } from '@superglue/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as logs from './logs.js';
import {
    buildOAuthAuthorizationUrl,
    buildOAuthHeaders,
    handleOAuthCallback,
    isTokenExpired,
    refreshOAuthToken,
} from './oauth.js';

// Mock the logs module
vi.mock('./logs.js', () => ({
    logMessage: vi.fn(),
}));

// Mock fetch globally
global.fetch = vi.fn();

describe('OAuth Utilities', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.resetAllMocks();
    });

    describe('isTokenExpired', () => {
        it('should return false if no expires_at is set', () => {
            const integration: Integration = {
                id: 'test',
                urlHost: 'https://api.test.com',
                credentials: {},
            };
            expect(isTokenExpired(integration)).toBe(false);
        });

        it('should return false if token expires in more than 5 minutes', () => {
            const now = Date.now();
            const sixMinutesFromNow = new Date(now + 6 * 60 * 1000).toISOString();
            const integration: Integration = {
                id: 'test',
                urlHost: 'https://api.test.com',
                credentials: {
                    expires_at: sixMinutesFromNow,
                },
            };
            expect(isTokenExpired(integration)).toBe(false);
        });

        it('should return true if token expires in less than 5 minutes', () => {
            const now = Date.now();
            const fourMinutesFromNow = new Date(now + 4 * 60 * 1000).toISOString();
            const integration: Integration = {
                id: 'test',
                urlHost: 'https://api.test.com',
                credentials: {
                    expires_at: fourMinutesFromNow,
                },
            };
            expect(isTokenExpired(integration)).toBe(true);
        });

        it('should return true if token is already expired', () => {
            const now = Date.now();
            const oneMinuteAgo = new Date(now - 60 * 1000).toISOString();
            const integration: Integration = {
                id: 'test',
                urlHost: 'https://api.test.com',
                credentials: {
                    expires_at: oneMinuteAgo,
                },
            };
            expect(isTokenExpired(integration)).toBe(true);
        });
    });

    describe('getTokenUrl', () => {
        it('should return token URL for known integration by ID', () => {
            const integration: Integration = {
                id: 'github',
                urlHost: 'https://api.github.com',
                credentials: {},
            };
            expect(getOAuthTokenUrl(integration)).toBe('https://github.com/login/oauth/access_token');
        });

        it('should return token URL for known integration by URL host', () => {
            const integration: Integration = {
                id: 'my-github',
                urlHost: 'https://api.github.com',
                credentials: {},
            };
            expect(getOAuthTokenUrl(integration)).toBe('https://github.com/login/oauth/access_token');
        });

        it('should return custom token URL from credentials', () => {
            const integration: Integration = {
                id: 'custom',
                urlHost: 'https://api.custom.com',
                credentials: {
                    token_url: 'https://custom.com/oauth/token',
                },
            };
            expect(getOAuthTokenUrl(integration)).toBe('https://custom.com/oauth/token');
        });

        it('should return default token URL for unknown integration', () => {
            const integration: Integration = {
                id: 'unknown',
                urlHost: 'https://api.unknown.com',
                credentials: {},
            };
            expect(getOAuthTokenUrl(integration)).toBe('https://api.unknown.com/oauth/token');
        });
    });

    describe('refreshOAuthToken', () => {
        it('should return false if missing required credentials', async () => {
            const integration: Integration = {
                id: 'test',
                urlHost: 'https://api.test.com',
                credentials: {
                    client_id: 'test-id',
                    // missing client_secret and refresh_token
                },
            };

            const result = await refreshOAuthToken(integration);
            expect(result).toBe(false);
            expect(logs.logMessage).toHaveBeenCalledWith(
                'error',
                'Missing required credentials for token refresh',
                expect.any(Object)
            );
        });

        it('should successfully refresh token', async () => {
            const integration: Integration = {
                id: 'test',
                urlHost: 'https://api.test.com',
                credentials: {
                    client_id: 'test-id',
                    client_secret: 'test-secret',
                    refresh_token: 'old-refresh-token',
                },
            };

            const mockTokenResponse = {
                access_token: 'new-access-token',
                refresh_token: 'new-refresh-token',
                token_type: 'Bearer',
                expires_in: 3600,
            };

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => mockTokenResponse,
            });

            const result = await refreshOAuthToken(integration);
            
            expect(result).toBe(true);
            expect(integration.credentials.access_token).toBe('new-access-token');
            expect(integration.credentials.refresh_token).toBe('new-refresh-token');
            expect(integration.credentials.token_type).toBe('Bearer');
            expect(integration.credentials.expires_at).toBeDefined();
        });

        it('should handle token refresh failure', async () => {
            const integration: Integration = {
                id: 'test',
                urlHost: 'https://api.test.com',
                credentials: {
                    client_id: 'test-id',
                    client_secret: 'test-secret',
                    refresh_token: 'old-refresh-token',
                },
            };

            (global.fetch as any).mockResolvedValueOnce({
                ok: false,
                status: 401,
                text: async () => 'Unauthorized',
            });

            const result = await refreshOAuthToken(integration);
            
            expect(result).toBe(false);
            expect(logs.logMessage).toHaveBeenCalledWith(
                'error',
                'Error refreshing OAuth token',
                expect.objectContaining({
                    integrationId: 'test',
                    error: expect.stringContaining('Token refresh failed'),
                })
            );
        });
    });

    describe('buildOAuthHeaders', () => {
        it('should return empty object if no access token', () => {
            const integration: Integration = {
                id: 'test',
                urlHost: 'https://api.test.com',
                credentials: {},
            };
            expect(buildOAuthHeaders(integration)).toEqual({});
        });

        it('should build Bearer token header', () => {
            const integration: Integration = {
                id: 'test',
                urlHost: 'https://api.test.com',
                credentials: {
                    access_token: 'test-token',
                    token_type: 'Bearer',
                },
            };
            expect(buildOAuthHeaders(integration)).toEqual({
                Authorization: 'Bearer test-token',
            });
        });

        it('should default to Bearer type if not specified', () => {
            const integration: Integration = {
                id: 'test',
                urlHost: 'https://api.test.com',
                credentials: {
                    access_token: 'test-token',
                },
            };
            expect(buildOAuthHeaders(integration)).toEqual({
                Authorization: 'Bearer test-token',
            });
        });
    });

    describe('handleOAuthCallback', () => {
        const mockGetIntegration = vi.fn();
        const mockUpdateIntegration = vi.fn();
        const redirectUri = 'https://test.com/api/auth/callback';

        beforeEach(() => {
            mockGetIntegration.mockReset();
            mockUpdateIntegration.mockReset();
        });

        it('should handle integration not found', async () => {
            mockGetIntegration.mockResolvedValueOnce(null);

            const result = await handleOAuthCallback(
                'test-integration',
                'auth-code',
                redirectUri,
                mockGetIntegration,
                mockUpdateIntegration
            );

            expect(result).toEqual({
                success: false,
                error: 'Integration not found',
            });
        });

        it('should handle missing OAuth credentials', async () => {
            mockGetIntegration.mockResolvedValueOnce({
                id: 'test',
                urlHost: 'https://api.test.com',
                credentials: {},
            });

            const result = await handleOAuthCallback(
                'test',
                'auth-code',
                redirectUri,
                mockGetIntegration,
                mockUpdateIntegration
            );

            expect(result).toEqual({
                success: false,
                error: 'OAuth client credentials not configured',
            });
        });

        it('should successfully exchange code for tokens', async () => {
            const integration: Integration = {
                id: 'test',
                urlHost: 'https://api.test.com',
                credentials: {
                    client_id: 'test-id',
                    client_secret: 'test-secret',
                },
            };

            mockGetIntegration.mockResolvedValueOnce(integration);

            const mockTokenResponse = {
                access_token: 'new-access-token',
                refresh_token: 'new-refresh-token',
                token_type: 'Bearer',
                expires_in: 3600,
            };

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => mockTokenResponse,
            });

            const result = await handleOAuthCallback(
                'test',
                'auth-code',
                redirectUri,
                mockGetIntegration,
                mockUpdateIntegration
            );

            expect(result.success).toBe(true);
            expect(result.integration).toBeDefined();
            expect(result.integration?.credentials.access_token).toBe('new-access-token');
            expect(mockUpdateIntegration).toHaveBeenCalledWith('test', expect.objectContaining({
                credentials: expect.objectContaining({
                    access_token: 'new-access-token',
                    refresh_token: 'new-refresh-token',
                }),
            }));
        });

        it('should handle token exchange failure', async () => {
            const integration: Integration = {
                id: 'test',
                urlHost: 'https://api.test.com',
                credentials: {
                    client_id: 'test-id',
                    client_secret: 'test-secret',
                },
            };

            mockGetIntegration.mockResolvedValueOnce(integration);

            (global.fetch as any).mockResolvedValueOnce({
                ok: false,
                text: async () => 'Invalid authorization code',
            });

            const result = await handleOAuthCallback(
                'test',
                'auth-code',
                redirectUri,
                mockGetIntegration,
                mockUpdateIntegration
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('Token exchange failed');
        });
    });

    describe('buildOAuthAuthorizationUrl', () => {
        it('should return null if no client_id', () => {
            const integration: Integration = {
                id: 'test',
                urlHost: 'https://api.test.com',
                credentials: {},
            };
            const url = buildOAuthAuthorizationUrl(integration, 'https://test.com/callback');
            expect(url).toBeNull();
        });

        it('should build URL with auth_url from credentials', () => {
            const integration: Integration = {
                id: 'test',
                urlHost: 'https://api.test.com',
                credentials: {
                    client_id: 'test-id',
                    auth_url: 'https://auth.test.com/authorize',
                    scope: 'read write',
                },
            };
            
            const url = buildOAuthAuthorizationUrl(integration, 'https://test.com/callback', 'test-state');
            
            expect(url).toContain('https://auth.test.com/authorize');
            expect(url).toContain('client_id=test-id');
            expect(url).toContain('redirect_uri=https%3A%2F%2Ftest.com%2Fcallback');
            expect(url).toContain('response_type=code');
            expect(url).toContain('scope=read+write');
            expect(url).toContain('state=test-state');
        });

        it('should use auth URL from known integration', () => {
            const integration: Integration = {
                id: 'github',
                urlHost: 'https://api.github.com',
                credentials: {
                    client_id: 'github-client-id',
                },
            };
            
            const url = buildOAuthAuthorizationUrl(integration, 'https://test.com/callback');
            
            expect(url).toContain('https://github.com/login/oauth/authorize');
            expect(url).toContain('client_id=github-client-id');
        });

        it('should return null if no auth URL can be determined', () => {
            const integration: Integration = {
                id: 'unknown',
                urlHost: 'https://api.unknown.com',
                credentials: {
                    client_id: 'test-id',
                },
            };
            
            const url = buildOAuthAuthorizationUrl(integration, 'https://test.com/callback');
            expect(url).toBeNull();
        });
    });
}); 