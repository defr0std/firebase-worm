import "reflect-metadata";

const EntityKey = "fireworm:entity";

export class Entity {
  $id?: string;
}

export interface ClassConstructor<T = any> {
    new(): T;
}

export function entity(path: string) {
  return function (c: Function) {
    const metadata: EntityMetadata = {path};
    Reflect.defineMetadata(EntityKey, metadata, c);
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
