import { compare } from "fast-json-patch";
import { database } from "firebase-admin";

export class SessionImpl {
  private readonly cache: object;
  private updates: object;
  private inserts: object;

  constructor(public readonly db: database.Database) {
    this.cache = {};
    this.updates = {};
    this.inserts = {};
  }

  public save(entity: any, path: string): void {
    entity = this.removeId(entity);
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

  public addToCache(entity: any, path: string) {
    // Prevent new cache updates to preserve consistency of the current data
    // view. Consider optimistic conflict detection if needed.
    if (!this.isUpdateStarted()) {
      this.cache[path] = this.removeId(entity);
    }
  }

  private isUpdateStarted(): boolean {
    for (const id in this.updates) {
      if (this.updates.hasOwnProperty(id)) {
        return true;
      }
    }
    return false;
  }

  private removeId(entity: any) {
    const clone = Object.assign({}, entity);
    delete clone.$id;
    return clone;
  }
}
