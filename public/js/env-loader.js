export async function loadEnv() {
  try {
    const response = await fetch('/api/env-config');
    if (!response.ok) {
      throw new Error('Failed to load environment config');
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading environment:', error);
    // Fallback values for development
    return {
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD: 'admin123',
      USER1_USERNAME: 'user1',
      USER1_PASSWORD: 'user1pass',
      USER2_USERNAME: 'user2',
      USER2_PASSWORD: 'user2pass'
    };
  }
}