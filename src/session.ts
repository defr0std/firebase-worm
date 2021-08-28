import { EntitySpec } from "./entity";
import { SessionImpl } from "./sessionImpl";
import { Repository } from "./repository";
import { database } from "firebase-admin";

export class Session {
  private readonly sessionImpl: SessionImpl;

  constructor(db: database.Database) {
    this.sessionImpl = new SessionImpl(db);
  }

  public repository<T>(spec: EntitySpec<T>) {
    return new Repository<T>(this.sessionImpl, spec);
  }

  public async commit(): Promise<void> {
    await this.sessionImpl.commit();
  }

  public getUpdates(): object {
    return this.sessionImpl.getUpdates();
  }
}

