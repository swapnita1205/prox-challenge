/**
 * Demo mock mode is for frontend development only (vision fallback).
 * Disabled by default — never fakes agent chat responses.
 */
export function isDemoMockEnvEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MOCK_ENABLED === "true";
}

export function canShowDemoMockToggle(): boolean {
  return process.env.NODE_ENV === "development" || isDemoMockEnvEnabled();
}
