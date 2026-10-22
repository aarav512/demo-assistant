import { MemoryStore } from "@/lib/data/memory";
import type { Repository } from "@/lib/data/repository";
import { SupabaseStore } from "@/lib/data/supabase-store";
import { createServiceClient } from "@/lib/supabase/server";

let testRepository: Repository | null = null;
let memory: MemoryStore | null = null;

export function setRepositoryForTests(repository: Repository | null): void {
  testRepository = repository;
}

export function getRepository(): Repository {
  if (testRepository) return testRepository;
  const client = createServiceClient();
  if (client) return new SupabaseStore(client);
  if (!memory) memory = new MemoryStore();
  return memory;
}

export function storageMode(): "memory" | "supabase" {
  return getRepository().mode;
}
