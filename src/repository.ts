import { SessionImpl } from "./sessionImpl";
import { ClassConstructor, entityPath, Entity } from "./entity";
import { Observable, ReplaySubject, BehaviorSubject } from "rxjs";
import { map, first } from "rxjs/operators";
import { QueryFunc, Query } from "./query";

export class Repository<T extends Entity> {
  constructor(private readonly sessionImpl: SessionImpl, private readonly cls: ClassConstructor<T>) {
  }

  public findById(id: string): Observable<T> {
    const path = this.combinePath(entityPath(this.cls), id);
    return this.observableObject<T>(path).pipe(
      map((entity) => {
        if (entity) {
          entity.$id = id;
          this.sessionImpl.addToCache(entity, path);
        }
        return entity;
      }),
    );
  }

  public findByIdAsPromise(id: string): Promise<T> {
    return this.findById(id).pipe(first()).toPromise();
  }

  public findAll(query?: QueryFunc<T>): Observable<T[]> {
    const basePath = entityPath(this.cls);
    return this.observableList(basePath, query).pipe(
      map((entityList) => {
        for (let i = 0; i < entityList.entities.length; ++i) {
          entityList.entities[i].$id = entityList.ids[i];
          const fullPath = this.combinePath(basePath, entityList.ids[i]);
          this.sessionImpl.addToCache(entityList.entities[i], fullPath);
        }
        return entityList.entities;
      }),
    );
  }

  public save(entity: T) {
    this.sessionImpl.save(entity, this.objectPath(entity));
  }

  public delete(entity: T) {
    this.sessionImpl.delete(this.objectPath(entity));
  }

  public deleteById(id: string) {
    const path = this.combinePath(entityPath(this.cls), id);
    this.sessionImpl.delete(path);
  }

  private observableList(path: string, query?: QueryFunc<T>): Observable<EntityList<T>> {
    const res: EntityList<T> = {
      entities: [],
      ids: [],
    };
    const sub = new BehaviorSubject<EntityList<T>>(res);
    let ref: firebase.database.Query = this.sessionImpl.db.ref(path);
    if (query) {
      const q = query(new Query<T>());
      ref = q.toRef(ref);
    }
    ref.on("child_added", (s, prevKey) => {
      const prevIndex = res.ids.findIndex(x => x === prevKey);
      if (prevIndex === -1) {
        res.entities.push(s.val());
        res.ids.push(s.key);
      }
      else {
        res.entities.splice(prevIndex + 1, 0, s.val());
        res.ids.splice(prevIndex + 1, 0, s.key);
      }
      sub.next(res);
    });
    return sub;
  }

  private observableObject<T>(path: string): Observable<T> {
    const sub = new ReplaySubject<T>(1);
    const ref = this.sessionImpl.db.ref(path);
    ref.on("value", (s) => {
      sub.next(s.val());
    });
    return sub;
  }

  private combinePath(base: string, child: string) {
    return base + '/' + child;
  }

  private objectPath(entity: T) {
    return this.combinePath(entityPath(this.cls), entity.$id);
  }
}

interface EntityList<T> {
  entities: T[];
  ids: string[];
}
