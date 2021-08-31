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

export function entityPath(cls: ClassConstructor): PathComponent[] {
  const metadata = Reflect.getMetadata(EntityKey, cls) as EntityMetadata;
  if (!metadata) {
    throw new Error(`${cls} is not marked as @entity`);
  }
  return metadata.path;
}

export type BoundPath = { kind: "bound"; binding: string };
export type LiteralPath = { kind: "literal"; literal: string };
export type PathComponent = LiteralPath | BoundPath;

export interface PathMap {
  id?: string;
  [boundField: string]: string;
}

export function analyzePath(path: string): PathComponent[] {
  const result: PathComponent[] = [];
  const r = /\{.*?\}/g;
  let m: RegExpExecArray;
  let lastIndex = -1;
  while ((m = r.exec(path))) {
    if (m.length !== 1) {
      throw new Error(`Could not register entity with path ${path}`);
    }
    if (m.index - lastIndex > 1) {
      result.push({ kind: "literal", literal: path.substring(lastIndex + 1, m.index) });
    }
    result.push({ kind: "bound", binding: m[0].substr(1, m[0].length - 2) });
    lastIndex = m.index + m[0].length - 1;
  }
  if (result.length > 0 && lastIndex !== path.length - 1) {
    result.push({ kind: "literal", literal: path.substring(lastIndex + 1, path.length) });
  }
  if (result.length === 0) {
    result.push({ kind: "literal", literal: path });
  }
  return result;
}

interface EntityMetadata {
  path: PathComponent[];
}

export function registerPersistedEntity(cls: ClassConstructor, path: string) {
  const metadata: EntityMetadata = { path: analyzePath(path) };
  Reflect.defineMetadata(EntityKey, metadata, cls);
}
