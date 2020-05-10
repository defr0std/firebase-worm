import { database } from "firebase/app";
import { ClassConstructor, Entity } from "./entity";
import { SessionImpl } from "./sessionImpl";
import { Repository } from "./repository";

export class Session {
  private readonly sessionImpl: SessionImpl;

  constructor(db: database.Database) {
    this.sessionImpl = new SessionImpl(db);
  }

  public repository<T extends Entity>(cls: ClassConstructor<T>) {
    return new Repository<T>(this.sessionImpl, cls);
  }

  public async commit(): Promise<void> {
    await this.sessionImpl.commit();
  }
}

