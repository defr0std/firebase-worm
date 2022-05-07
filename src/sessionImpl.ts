import { compare } from "fast-json-patch";
import { database } from "firebase-admin";
import { PathMap } from "./entity";

export class SessionImpl {
  private readonly cache: object;
  private updates: object;
  private inserts: object;

  constructor(public readonly db: database.Database) {
    this.cache = {};
    this.updates = {};
    this.inserts = {};
  }

  public save(entity: any, path: string, pathMap?: PathMap): void {
    entity = this.cloneForSave(entity, pathMap);
    if (this.inserts[path]) {
      this.updates[path] = entity;
      return;
    }
    const cached = this.cache[path];
    if (cached) {
      const diff = compare(cached, entity);
      for (const operation of diff) {
        switch (operation.op) {
          case "add":
          case "replace":
            this.updates[`${path}${operation.path}`] = operation.value;
            break;
          case "remove":
            this.updates[`${path}${operation.path}`] = null;
            break;
        }
      }
      this.cache[path] = entity;
    }
    else {
      this.updates[path] = entity;
      this.inserts[path] = true;
    }
  }

  public delete(path: string): void {
    this.updates[path] = null;
  }

  public deleteAll(paths: string[]): void {
    for (const path of paths) {
      this.delete(path);
    }
  }

  public async commit(): Promise<void> {
    await this.db.ref().update(this.updates);
    this.updates = {};
    this.inserts = {};
  }

  public getUpdates(): object {
    return this.updates;
  }

  public addToCache(entity: any, path: string, pathMap?: PathMap) {
    // Prevent new cache updates to preserve consistency of the current data
    // view. Consider optimistic conflict detection if needed.
    if (!this.cache[path]) {
      this.cache[path] = this.cloneForSave(entity, pathMap);
    }
  }

  private cloneForSave(entity: any, pathMap?: PathMap) {
    const clone = Object.assign({}, entity);
    delete clone.id;
    if (pathMap) {
      for (const field in pathMap) {
        if (!pathMap.hasOwnProperty(field)) {
          continue;
        }
        delete clone[field];
      }
    }
    return clone;
  }
}
