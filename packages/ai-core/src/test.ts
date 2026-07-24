// Thin re-export so consumers (loot-core) can build fake models for their
// own tests without taking a direct devDependency on `ai` — the AI SDK
// version stays pinned in this one package.
export { MockLanguageModelV4, simulateReadableStream } from 'ai/test';
