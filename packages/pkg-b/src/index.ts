import { helloFromA, VERSION } from 'pkg-a';
import { type User, type Config } from 'pkg-a/schemas';

export function helloFromB() {
  return `${helloFromA()} and Hello from package B (version: ${VERSION})`;
}

export function createUser(id: string, name: string): User {
  return { id, name };
}

export function createConfig(): Config {
  return {
    apiUrl: 'https://api.example.com',
    timeout: 5000,
  };
}
