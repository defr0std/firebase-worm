import "reflect-metadata";

const EntityKey = "fireworm:entity";

export interface PersistedEntity {
  id?: string;
}

export interface ClassConstructor<T = any> {
  new(): T;
}

export type EntitySpec<T> = ClassConstructor<T> | string;

export function entity(path: string) {
  return (c: ClassConstructor) => {
    registerPersistedEntity(c, path);
  }
}

export function entityPath(cls: ClassConstructor) {
  const metadata = Reflect.getMetadata(EntityKey, cls) as EntityMetadata;
  if (!metadata) {
    throw new Error(`${cls} is not marked as @entity`);
  }
  return metadata.path;
}

interface EntityMetadata {
  path: string;
}

export function registerPersistedEntity(cls: ClassConstructor, path: string) {
  const metadata: EntityMetadata = { path };
  Reflect.defineMetadata(EntityKey, metadata, cls);
}
